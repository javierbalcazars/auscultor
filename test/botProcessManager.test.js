import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  botIsRunning,
  resetWhatsAppSession,
  stopBotProcess,
  whatsappSessionIsLinked,
} from "../src/admin/botProcessManager.js";

test("considera vinculada una sesión que contiene la identidad de WhatsApp", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "whatsapp-session-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(path.join(directory, "creds.json"), JSON.stringify({ registered: false, me: { id: "56900000000:1@s.whatsapp.net" } }));

  assert.equal(whatsappSessionIsLinked(directory, { status: null }), true);
  assert.equal(whatsappSessionIsLinked(directory, { status: { whatsappLoggedOut: true } }), false);
  fs.writeFileSync(path.join(directory, "creds.json"), JSON.stringify({ registered: false }));
  assert.equal(whatsappSessionIsLinked(directory, { status: null }), false);
});

test("espera la detención antes de eliminar una sesión activa", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "whatsapp-reset-running-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(path.join(directory, "creds.json"), "{}", { mode: 0o600 });
  let checks = 0;
  let stopped = false;
  let started = false;

  await resetWhatsAppSession({
    authSessionPath: directory,
    isRunning: () => ++checks < 3,
    stop: () => { stopped = true; return true; },
    start: () => { started = true; return true; },
  });

  assert.equal(stopped, true);
  assert.equal(started, true);
  assert.equal(fs.existsSync(directory), false);
});

test("elimina la sesión local e inicia el bot para generar otro QR", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "whatsapp-reset-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(path.join(directory, "creds.json"), "{}", { mode: 0o600 });
  let started = false;

  await resetWhatsAppSession({
    authSessionPath: directory,
    isRunning: () => false,
    start: () => { started = true; return true; },
  });

  assert.equal(fs.existsSync(directory), false);
  assert.equal(started, true);
});

test("ignora un candado cuyo PID vivo no corresponde al bot", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "whatsapp-lock-check-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const lockPath = path.join(directory, ".bot-instance.lock");
  fs.writeFileSync(lockPath, JSON.stringify({ processId: process.pid, token: "pid-ajeno" }), { mode: 0o600 });

  assert.equal(botIsRunning({ lockPath }), false);
  assert.equal(stopBotProcess({ lockPath }), false);
});
