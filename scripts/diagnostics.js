#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  APP_VERSION,
  AUTH_SESSION_PATH,
  ENV_PATH,
  FAQS_PATH,
  PROJECT_ROOT,
  VAULT_PATH,
  loadRuntimeConfig,
} from "../src/config.js";

const checks = [];

function addCheck(name, ok, detail) {
  checks.push({ name, ok, detail });
}

function modeOf(targetPath) {
  return fs.existsSync(targetPath)
    ? (fs.statSync(targetPath).mode & 0o777).toString(8).padStart(3, "0")
    : null;
}

try {
  const config = loadRuntimeConfig();
  addCheck("configuración", true, `modelo=${process.env.OPENAI_MODEL || "gpt-4o-mini"}`);
  addCheck("retención", true, `${config.conversationRetentionDays} días`);
  addCheck("audios", true, `reenvío desde ${config.audioForwardMinSeconds} segundos`);
} catch (error) {
  addCheck("configuración", false, error.message);
}

addCheck("archivo .env", fs.existsSync(ENV_PATH), `permisos=${modeOf(ENV_PATH) || "ausente"}`);
addCheck("Vault", fs.existsSync(VAULT_PATH), VAULT_PATH);
const faqCount = fs.existsSync(FAQS_PATH)
  ? fs.readdirSync(FAQS_PATH, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md")).length
  : 0;
addCheck("FAQs", faqCount > 0, `${faqCount} documento(s)`);
addCheck(
  "sesión de WhatsApp",
  fs.existsSync(path.join(AUTH_SESSION_PATH, "creds.json")),
  fs.existsSync(AUTH_SESSION_PATH) ? `permisos=${modeOf(AUTH_SESSION_PATH)}` : "ausente"
);

console.log(`Diagnóstico local de whatsapp-bot ${APP_VERSION}`);
console.log(`Proyecto: ${PROJECT_ROOT}`);
for (const check of checks) {
  console.log(`${check.ok ? "OK" : "ERROR"}  ${check.name}: ${check.detail}`);
}

if (checks.some((check) => !check.ok)) process.exitCode = 1;
