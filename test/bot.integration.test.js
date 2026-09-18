import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as wait } from "node:timers/promises";
import { getConversationPath, loadConversation, saveConversation } from "../src/conversationStore.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const mockRuntime = fileURLToPath(new URL("./fixtures/mock-runtime.mjs", import.meta.url));
const clientJid = "123456@lid";
const supportJid = "56912345678@s.whatsapp.net";
let incomingId = 0;

function project(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "whatsapp-integration-"));
  fs.cpSync(path.join(root, "src"), path.join(directory, "src"), { recursive: true });
  fs.copyFileSync(path.join(root, "package.json"), path.join(directory, "package.json"));
  fs.symlinkSync(path.join(root, "node_modules"), path.join(directory, "node_modules"));
  fs.cpSync(
    path.join(root, "test", "fixtures", "faqs"),
    path.join(directory, "Vault", "FAQs"),
    { recursive: true }
  );
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

async function runBot(t, directory, overrides = {}) {
  const child = spawn(process.execPath, ["--import", mockRuntime, "src/index.js"], {
    cwd: directory,
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    env: {
      PATH: process.env.PATH, TZ: "America/Santiago",
      BUSINESS_NAME: "Glamping de Prueba",
      OPENAI_API_KEY: "sk-simulacion", HUMAN_SUPPORT_NUMBER: "56912345678",
      IGNORE_NUMBERS: "56912345678", RESPONSE_DELAY_MS: "30",
      SIGNAL_STARTUP_VALIDATION_MS: "500", OPENAI_TIMEOUT_MS: "3000",
      ...overrides,
    },
  });
  const events = [];
  let output = "";
  child.on("message", (event) => events.push(event));
  child.stdout.on("data", (data) => { output += data; });
  child.stderr.on("data", (data) => { output += data; });
  async function stop(signal = "SIGTERM") {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const ended = once(child, "exit");
    child.kill(signal);
    await ended;
  }
  t.after(() => stop());
  async function until(predicate) {
    for (let attempt = 0; attempt < 500; attempt += 1) {
      const result = predicate(events);
      if (result) return result;
      if (child.exitCode !== null || child.signalCode !== null) throw new Error(`El bot de prueba terminó: ${output}`);
      await wait(10);
    }
    throw new Error(`Tiempo agotado en el bot simulado: ${output}`);
  }
  const send = (text, { jid = clientJid, fromMe = false, audioSeconds } = {}) => child.send({
    type: "message",
    message: {
      key: { remoteJid: jid, id: `incoming-${++incomingId}`, fromMe },
      pushName: "Cliente", messageTimestamp: Math.floor(Date.now() / 1000),
      message: audioSeconds === undefined
        ? { conversation: text }
        : { audioMessage: { seconds: audioSeconds, mimetype: "audio/ogg", ptt: true } },
    },
  });
  await until(() => output.includes("Asistente de WhatsApp conectado."));
  return { child, events, send, until, stop };
}

test("flujo real: agrupa mensajes, envía FAQ e historial limitado e ignora grupos y encargado", async (t) => {
  const directory = project(t);
  const chatPath = getConversationPath(path.join(directory, "Vault"), "Chats", clientJid);
  saveConversation(chatPath, {
    jid: clientJid, contactName: "Cliente",
    history: Array.from({ length: 10 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: `Anterior ${index}` })),
  });
  const bot = await runBot(t, directory);
  bot.send("Mensaje de grupo", { jid: "123@g.us" });
  bot.send("Mensaje del encargado", { jid: supportJid });
  bot.send("Hay suprmercdo");
  bot.send("cerca?");
  const request = await bot.until((events) => events.find((event) => event.event === "llm"));
  assert.equal(request.request.messages.length, 11); // system + 10 turnos
  assert.match(request.request.messages[0].content, /Información ficticia para pruebas/);
  assert.equal(request.request.messages.at(-1).content, "Hay suprmercdo\ncerca?");
  assert.equal(request.request.max_completion_tokens, 600);
  await bot.until((events) => events.find((event) => event.event === "sent" && event.jid === clientJid));
  await bot.until(() => loadConversation(chatPath, 24)?.history.at(-1)?.role === "assistant");
  assert.equal(loadConversation(chatPath, 24).history.length, 10);
  bot.send("¿Y a cuánto tiempo?");
  const followup = await bot.until((events) => events.filter((event) => event.event === "llm")[1]);
  assert.match(followup.request.messages.at(-2).content, /Unimarc/);
  assert.equal(bot.events.filter((event) => event.event === "llm").length, 2);
});

test("flujo real: una respuesta manual cancela la salida que OpenAI estaba preparando", async (t) => {
  const directory = project(t);
  const bot = await runBot(t, directory, { MOCK_LLM_MANUAL: "1" });
  bot.send("¿Hay supermercados?");
  await bot.until((events) => events.some((event) => event.event === "llm"));
  bot.send("Hola, soy el encargado y te ayudaré.", { fromMe: true });
  bot.child.send({ type: "answer" });
  const chatPath = getConversationPath(path.join(directory, "Vault"), "Chats", clientJid);
  await bot.until(() => loadConversation(chatPath, 24)?.history.at(-1)?.source === "human");
  assert.equal(loadConversation(chatPath, 24).awaitingHuman, true);
  assert.equal(bot.events.filter((event) => event.event === "sent" && event.jid === clientJid).length, 0);
});

test("flujo real: reinicio abrupto conserva el aviso y la pausa, y lo entrega al conectar", async (t) => {
  const directory = project(t);
  const first = await runBot(t, directory, { MOCK_FAIL_SUPPORT: "1" });
  first.send("Quiero reservar para mañana");
  await first.until((events) => events.some((event) => event.event === "send-failed"));
  await first.stop("SIGKILL");
  const pendingPath = path.join(directory, "data", "pending-human-alerts.json");
  const chatPath = getConversationPath(path.join(directory, "Vault"), "Chats", clientJid);
  assert.equal(JSON.parse(fs.readFileSync(pendingPath)).alerts.length, 1);
  assert.equal(loadConversation(chatPath, 24).awaitingHuman, true);

  const restarted = await runBot(t, directory);
  const delivery = await restarted.until((events) => events.find((event) => event.event === "sent" && event.jid === supportJid));
  assert.match(delivery.text, /Quiero reservar para mañana/);
  await restarted.until(() => loadConversation(chatPath, 24)?.humanNotifiedAt);
  assert.equal(JSON.parse(fs.readFileSync(pendingPath)).alerts.length, 0);
  restarted.send("¿Alguien puede revisar?");
  await restarted.until(() => loadConversation(chatPath, 24).history.at(-1).content === "¿Alguien puede revisar?");
  assert.equal(restarted.events.filter((event) => event.event === "llm").length, 0);
});

test("flujo real: solicita texto para audio corto y reenvía audio largo con aviso", async (t) => {
  const directory = project(t);
  const bot = await runBot(t, directory);
  bot.send("", { audioSeconds: 5 });
  const shortReply = await bot.until((events) => events.find((event) => event.event === "sent" && event.jid === clientJid));
  assert.match(shortReply.text, /escríbenos tu consulta/);
  bot.send("", { audioSeconds: 25 });
  await bot.until((events) => events.some((event) => event.event === "sent" && event.jid === supportJid && event.audio));
  await bot.until((events) => events.filter((event) => event.event === "sent" && event.jid === clientJid).length === 2);
  assert.equal(bot.events.filter((event) => event.event === "llm").length, 0);
});
