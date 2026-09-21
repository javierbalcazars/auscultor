#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENV_PATH } from "../config.js";
import { readAdminConfig, saveAdminConfig } from "./configStore.js";
import { createAdminBackup, readAdminTools, restoreAdminBackup } from "./adminTools.js";
import { activateBotProcess, botIsRunning, currentBotStatus, resetWhatsAppSession, startBotProcess, startWhatsAppSetupProcess, stopBotProcess } from "./botProcessManager.js";
import { deleteFaq, FAQ_TEMPLATES, listFaqs, saveFaq } from "./faqStore.js";
import { createOpenAiHealthChecker } from "./openAiHealth.js";

const HOST = "127.0.0.1";
const PORT = Number(process.env.ADMIN_PORT || 3210);
const TOKEN = crypto.randomBytes(24).toString("hex");
const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const assets = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/icon.svg", ["icon.svg", "image/svg+xml"]],
]);
const openAiHealth = createOpenAiHealthChecker();

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

function activePort() {
  const address = server.address();
  return typeof address === "object" && address ? address.port : PORT;
}

function allowedOrigin(request) {
  const origin = request.headers.origin;
  const port = activePort();
  return !origin || origin === `http://${HOST}:${port}` || origin === `http://localhost:${port}`;
}

function allowedHost(request) {
  const port = activePort();
  return request.headers.host === `${HOST}:${port}` || request.headers.host === `localhost:${port}`;
}

function authorized(request) {
  return allowedOrigin(request) && request.headers["x-csrf-token"] === TOKEN;
}

async function readJson(request, limit = 300_000) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > limit) throw new Error("La solicitud es demasiado grande");
  }
  return JSON.parse(raw || "{}");
}

const server = http.createServer(async (request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'");
  try {
    if (!allowedHost(request)) return json(response, 403, { error: "Host rechazado" });
    if (request.method === "GET" && request.url === "/api/config") {
      return json(response, 200, { config: readAdminConfig(), csrfToken: TOKEN, setupRequired: !fs.existsSync(ENV_PATH) });
    }
    if (request.method === "GET" && request.url === "/api/faqs") {
      return json(response, 200, { documents: listFaqs(), templates: FAQ_TEMPLATES });
    }
    if (request.method === "PUT" && request.url === "/api/faqs") {
      if (!authorized(request)) return json(response, 403, { error: "Solicitud rechazada" });
      const document = saveFaq(await readJson(request));
      return json(response, 200, { document, message: "Información guardada y disponible para las próximas respuestas." });
    }
    if (request.method === "DELETE" && request.url === "/api/faqs") {
      if (!authorized(request)) return json(response, 403, { error: "Solicitud rechazada" });
      deleteFaq((await readJson(request)).name);
      return json(response, 200, { message: "FAQ eliminada. Se conservó un respaldo local." });
    }
    if (request.method === "GET" && request.url === "/api/tools") {
      return json(response, 200, readAdminTools());
    }
    if (request.method === "POST" && request.url === "/api/tools/backup") {
      if (!authorized(request)) return json(response, 403, { error: "Solicitud rechazada" });
      if (botIsRunning()) return json(response, 409, { error: "Detén el bot antes de crear un respaldo" });
      const result = await createAdminBackup((await readJson(request, 10_000)).passphrase);
      return json(response, 201, { message: `Respaldo cifrado creado en ${result.destination}`, included: result.included });
    }
    if (request.method === "POST" && request.url === "/api/tools/restore") {
      if (!authorized(request)) return json(response, 403, { error: "Solicitud rechazada" });
      if (botIsRunning()) return json(response, 409, { error: "Detén el bot antes de restaurar" });
      const input = await readJson(request, 10_000);
      const result = await restoreAdminBackup(input.name, input.passphrase, input.confirmed);
      return json(response, 200, { message: `Restauración completada. Respaldo previo: ${result.rollback}` });
    }
    if (request.method === "GET" && request.url === "/api/status") {
      return json(response, 200, currentBotStatus());
    }
    if (request.method === "GET" && request.url === "/api/health") {
      const botStatus = currentBotStatus();
      return json(response, 200, {
        whatsapp: botStatus.whatsappState === "linked",
        whatsappState: botStatus.whatsappState,
        openai: await openAiHealth.check(),
      });
    }
    if (request.method === "POST" && request.url === "/api/bot/stop") {
      if (!authorized(request)) return json(response, 403, { error: "Solicitud rechazada" });
      const stopped = stopBotProcess();
      return json(response, 200, { stopped, message: stopped ? "Se solicitó detener el bot." : "El bot ya estaba detenido." });
    }
    if (request.method === "POST" && request.url === "/api/bot/start") {
      if (!authorized(request)) return json(response, 403, { error: "Solicitud rechazada" });
      const started = await activateBotProcess();
      return json(response, started ? 202 : 200, { started, message: started ? "El bot se está iniciando." : "El bot ya está activo." });
    }
    if (request.method === "POST" && request.url === "/api/whatsapp/setup") {
      if (!authorized(request)) return json(response, 403, { error: "Solicitud rechazada" });
      const started = startWhatsAppSetupProcess();
      return json(response, started ? 202 : 200, {
        started,
        message: started ? "WhatsApp se está preparando para mostrar el QR." : "La configuración de WhatsApp ya está activa.",
      });
    }
    if (request.method === "POST" && request.url === "/api/whatsapp/reset") {
      if (!authorized(request)) return json(response, 403, { error: "Solicitud rechazada" });
      await resetWhatsAppSession({ start: () => startBotProcess({ configurationOnly: true }) });
      return json(response, 202, { reset: true, message: "Sesión de WhatsApp eliminada. Esperando un QR nuevo." });
    }
    if (request.method === "PUT" && request.url === "/api/config") {
      if (!authorized(request)) return json(response, 403, { error: "Solicitud rechazada" });
      if (botIsRunning()) return json(response, 409, { error: "Detén el bot antes de modificar la configuración" });
      const config = saveAdminConfig(await readJson(request, 100_000));
      openAiHealth.reset();
      return json(response, 200, { config, message: "Configuración guardada. Reinicia el bot para aplicarla." });
    }
    const asset = assets.get(request.url);
    if (request.method === "GET" && asset) {
      const [file, contentType] = asset;
      response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
      return response.end(fs.readFileSync(path.join(PUBLIC_DIR, file)));
    }
    return json(response, 404, { error: "No encontrado" });
  } catch (error) {
    const status = Number.isInteger(error.statusCode) ? error.statusCode : 400;
    return json(response, status, { error: error instanceof SyntaxError ? "El contenido enviado no es JSON válido" : error.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Panel de configuración disponible en http://${HOST}:${activePort()}`);
  console.log("El panel solo acepta conexiones desde este equipo.");
});
