#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { APP_EDITION, APP_VERSION, ENV_PATH, resolveProjectPath } from "../config.js";
import { createCreatorAvatarCache } from "./creatorAvatar.js";
import { readAdminConfig, saveAdminConfig } from "./configStore.js";
import { createAdminBackup, readAdminTools, restoreAdminBackup } from "./adminTools.js";
import { activateBotProcess, botIsRunning, currentBotStatus, resetWhatsAppSession, startBotProcess, startWhatsAppSetupProcess, stopBotProcess } from "./botProcessManager.js";
import { deleteFaq, FAQ_TEMPLATES, listFaqs, saveFaq } from "./faqStore.js";
import { createOpenAiHealthChecker } from "./openAiHealth.js";
import { readAvailability } from "./availabilityStore.js";
import { authStatus, isAuthenticated, loginAdmin, logoutAdmin, setupAdmin, verifyAdminPassword } from "./authStore.js";
import { readCustomPrompt, saveCustomPrompt } from "./promptStore.js";
import { buildSystemPrompt } from "../llm.js";
import { loadConversation } from "../conversationStore.js";

const HOST = "127.0.0.1";
const PORT = Number(process.env.ADMIN_PORT || 3210);
const TOKEN = crypto.randomBytes(24).toString("hex");
const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const assets = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/i18n.js", ["i18n.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/icon.svg", ["icon.svg", "image/svg+xml"]],
]);
const openAiHealth = createOpenAiHealthChecker();
const creatorAvatar = createCreatorAvatarCache();

function parseAppsScriptResponse(text) {
  try { return JSON.parse(text); } catch {}
  // HtmlService devuelve una página contenedora cuyo resultado JSON queda
  // serializado dentro del campo userHtml.
  const match = String(text).match(/userHtml\\x22:\\x22([\s\S]*?)\\x22,\\x22ncc/);
  if (match) {
    const decoded = match[1]
      .replace(/\\x([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replaceAll('\\\\"', '"');
    try { return JSON.parse(decoded); } catch {}
  }
  return { message: String(text).slice(0, 300) };
}

function readAdminChats() {
  const config = readAdminConfig();
  const chatsPath = resolveProjectPath(path.join(config.VAULT_PATH, config.CONVERSATIONS_FOLDER));
  if (!fs.existsSync(chatsPath)) return [];
  return fs.readdirSync(chatsPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .flatMap((entry) => {
      const filePath = path.join(chatsPath, entry.name);
      const conversation = loadConversation(filePath, Number(config.CONVERSATION_EXPIRY_HOURS));
      if (!conversation) return [];
      const raw = fs.readFileSync(filePath, "utf8");
      const jid = raw.match(/^jid:\s*(.+)$/m)?.[1]?.trim() || entry.name.replace(/\.md$/i, "");
      return [{
        id: jid,
        name: conversation.contactName || jid,
        firstMessageAt: conversation.history[0]?.time || conversation.lastMessageAt,
        lastMessageAt: conversation.lastMessageAt,
        awaitingHuman: conversation.awaitingHuman,
        managedByBot: conversation.managedByBot,
        isExpired: conversation.isExpired,
        history: conversation.history,
      }];
    })
    .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
}

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
  return allowedOrigin(request) && request.headers["x-csrf-token"] === TOKEN && isAuthenticated(readCookie(request, "auscultor_session"));
}

function readCookie(request, name) {
  const cookie = request.headers.cookie || "";
  return cookie.split(";").map((part) => part.trim().split("=")).find(([key]) => key === name)?.[1] || "";
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
    if (request.method === "GET" && request.url === "/api/auth/status") return json(response, 200, authStatus());
    if (request.method === "POST" && request.url === "/api/auth/setup") {
      const body = await readJson(request);
      const username = setupAdmin(body.username, body.password);
      const session = loginAdmin(username, body.password);
      response.setHeader("Set-Cookie", `auscultor_session=${session}; HttpOnly; SameSite=Strict; Path=/`);
      return json(response, 200, { authenticated: true, username });
    }
    if (request.method === "POST" && request.url === "/api/auth/login") {
      const body = await readJson(request);
      const session = loginAdmin(body.username, body.password);
      response.setHeader("Set-Cookie", `auscultor_session=${session}; HttpOnly; SameSite=Strict; Path=/`);
      return json(response, 200, { authenticated: true });
    }
    if (request.method === "POST" && request.url === "/api/auth/logout") {
      logoutAdmin(readCookie(request, "auscultor_session"));
      response.setHeader("Set-Cookie", "auscultor_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
      return json(response, 200, { authenticated: false });
    }
    if (process.env.NODE_ENV !== "test" && request.url.startsWith("/api/") && request.url !== "/api/creator-avatar" && !isAuthenticated(readCookie(request, "auscultor_session"))) return json(response, 401, { error: "Autenticación requerida" });
    if (request.method === "GET" && request.url === "/api/config") {
      return json(response, 200, { config: readAdminConfig(), csrfToken: TOKEN, setupRequired: !fs.existsSync(ENV_PATH), version: APP_VERSION, edition: APP_EDITION });
    }
    if (request.method === "GET" && request.url === "/api/creator-avatar") {
      const avatar = await creatorAvatar.get();
      if (!avatar) {
        response.writeHead(302, { Location: "/icon.svg", "Cache-Control": "no-store" });
        return response.end();
      }
      response.writeHead(200, { "Content-Type": avatar.contentType, "Cache-Control": "no-store", ETag: avatar.etag });
      return response.end(avatar.image);
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
    if (request.method === "POST" && request.url === "/api/prompt/unlock") {
      if (!authorized(request)) return json(response, 403, { error: "Solicitud rechazada" });
      const body = await readJson(request, 10_000);
      if (!verifyAdminPassword(body.password)) return json(response, 401, { error: "Contraseña incorrecta" });
      return json(response, 200, { content: readCustomPrompt() || buildSystemPrompt("{{CONTEXTO_INTERNO}}", { includeCustom: false }) });
    }
    if (request.method === "POST" && request.url === "/api/prompt/verify") {
      if (!authorized(request)) return json(response, 403, { error: "Solicitud rechazada" });
      if (!verifyAdminPassword((await readJson(request, 10_000)).password)) return json(response, 401, { error: "Contraseña incorrecta" });
      return json(response, 200, { valid: true });
    }
    if (request.method === "PUT" && request.url === "/api/prompt") {
      if (!authorized(request)) return json(response, 403, { error: "Solicitud rechazada" });
      const body = await readJson(request, 30_000);
      if (!verifyAdminPassword(body.password)) return json(response, 401, { error: "Contraseña incorrecta" });
      saveCustomPrompt(body.content);
      return json(response, 200, { message: "Prompt guardado." });
    }
    if (request.method === "GET" && request.url === "/api/availability") {
      const configured = readAdminConfig().AVAILABILITY_SHEET_URL;
      return json(response, 200, await readAvailability({ url: configured }));
    }
    if (request.method === "GET" && request.url === "/api/chats") {
      return json(response, 200, { chats: readAdminChats() });
    }
    if (request.method === "POST" && request.url === "/api/availability/update") {
      if (!authorized(request)) return json(response, 403, { error: "Solicitud rechazada" });
      const editUrl = readAdminConfig().AVAILABILITY_EDIT_URL;
      if (!editUrl) return json(response, 409, { error: "Configura primero la URL de edición de Google Sheets" });
      const input = await readJson(request, 20_000);
      // Apps Script redirige las respuestas POST de Content/HTML service a
      // googleusercontent, donde algunos clientes reciben 405. El puente
      // admite la misma operación mediante GET con parámetros explícitos.
      const target = new URL(editUrl);
      target.searchParams.set("action", "update");
      for (const [key, value] of Object.entries(input)) {
        if (value !== undefined && value !== null) target.searchParams.set(key, String(value));
      }
      const upstream = await fetch(target, { method: "GET", redirect: "follow" });
      const text = await upstream.text();
      const body = parseAppsScriptResponse(text);
      if (!upstream.ok || body.ok === false) return json(response, 502, { error: body.error || "Google Sheets rechazó la modificación" });
      return json(response, 200, { message: body.message || "Día actualizado en Google Sheets." });
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
      return json(response, 200, { config, message: "Configuración guardada." });
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
  // Precarga la disponibilidad mientras el usuario completa el inicio de sesión.
  void readAvailability({ url: readAdminConfig().AVAILABILITY_SHEET_URL }).catch(() => {});
  void openAiHealth.check().catch(() => {});
});
