#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readAdminConfig, saveAdminConfig } from "./configStore.js";
import { botIsRunning, currentBotStatus, resetWhatsAppSession, startBotProcess, stopBotProcess } from "./botProcessManager.js";
import { createOpenAiHealthChecker } from "./openAiHealth.js";

const HOST = "127.0.0.1";
const PORT = Number(process.env.ADMIN_PORT || 3210);
const TOKEN = crypto.randomBytes(24).toString("hex");
const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const assets = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
]);
const openAiHealth = createOpenAiHealthChecker();

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

function allowedOrigin(request) {
  const origin = request.headers.origin;
  return !origin || origin === `http://${HOST}:${PORT}` || origin === `http://localhost:${PORT}`;
}

function allowedHost(request) {
  return request.headers.host === `${HOST}:${PORT}` || request.headers.host === `localhost:${PORT}`;
}

const server = http.createServer(async (request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'");
  try {
    if (!allowedHost(request)) return json(response, 403, { error: "Host rechazado" });
    if (request.method === "GET" && request.url === "/api/config") {
      return json(response, 200, { config: readAdminConfig(), csrfToken: TOKEN });
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
      if (!allowedOrigin(request) || request.headers["x-csrf-token"] !== TOKEN) return json(response, 403, { error: "Solicitud rechazada" });
      const stopped = stopBotProcess();
      return json(response, 200, { stopped, message: stopped ? "Se solicitó detener el bot." : "El bot ya estaba detenido." });
    }
    if (request.method === "POST" && request.url === "/api/bot/start") {
      if (!allowedOrigin(request) || request.headers["x-csrf-token"] !== TOKEN) return json(response, 403, { error: "Solicitud rechazada" });
      const started = startBotProcess();
      return json(response, started ? 202 : 200, {
        started,
        message: started ? "El bot se está iniciando." : "El bot ya está activo.",
      });
    }
    if (request.method === "POST" && request.url === "/api/whatsapp/reset") {
      if (!allowedOrigin(request) || request.headers["x-csrf-token"] !== TOKEN) return json(response, 403, { error: "Solicitud rechazada" });
      await resetWhatsAppSession();
      return json(response, 202, {
        reset: true,
        message: "Sesión de WhatsApp eliminada. Esperando un QR nuevo.",
      });
    }
    if (request.method === "PUT" && request.url === "/api/config") {
      if (!allowedOrigin(request) || request.headers["x-csrf-token"] !== TOKEN) return json(response, 403, { error: "Solicitud rechazada" });
      if (botIsRunning()) return json(response, 409, { error: "Detén el bot antes de modificar la configuración" });
      let raw = "";
      for await (const chunk of request) {
        raw += chunk;
        if (raw.length > 100_000) throw new Error("La solicitud es demasiado grande");
      }
      const config = saveAdminConfig(JSON.parse(raw));
      openAiHealth.reset();
      return json(response, 200, { config, message: "Configuración guardada. Reinicia el bot para aplicarla." });
    }
    const asset = assets.get(request.url);
    if (request.method === "GET" && asset) {
      const [file, contentType] = asset;
      response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
      return response.end(fs.readFileSync(path.join(PUBLIC_DIR, file)));
    }
    json(response, 404, { error: "No encontrado" });
  } catch (error) {
    json(response, 400, { error: error instanceof SyntaxError ? "El contenido enviado no es JSON válido" : error.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Panel de configuración disponible en http://${HOST}:${PORT}`);
  console.log("El panel solo acepta conexiones desde este equipo.");
});
