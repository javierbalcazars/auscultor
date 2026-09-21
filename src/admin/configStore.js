import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { DATA_ROOT, ENV_PATH } from "../config.js";

export const CONFIG_FIELDS = {
  VAULT_PATH: "./Vault",
  BUSINESS_NAME: "Mi Negocio",
  OPENAI_MODEL: "gpt-4o-mini",
  CONVERSATIONS_FOLDER: "Chats",
  CONVERSATION_EXPIRY_HOURS: "24",
  CONVERSATION_RETENTION_DAYS: "180",
  MAX_HISTORY_MESSAGES: "10",
  MAX_STORED_MESSAGES: "10",
  MAX_INPUT_CHARS: "6000",
  MAX_BATCH_MESSAGES: "20",
  MAX_REQUESTS_PER_HOUR: "30",
  RESPONSE_DELAY_MS: "4000",
  SIGNAL_STARTUP_VALIDATION_MS: "3000",
  AUDIO_FORWARD_MIN_SECONDS: "10",
  OPENAI_TIMEOUT_MS: "30000",
  OPENAI_MAX_OUTPUT_TOKENS: "600",
  HUMAN_ALERT_COOLDOWN_MINUTES: "60",
  HUMAN_TAKEOVER_HOURS: "2",
};

const NUMBER_RULES = {
  CONVERSATION_EXPIRY_HOURS: [0.1, Infinity, false],
  CONVERSATION_RETENTION_DAYS: [1, 3650, true],
  MAX_HISTORY_MESSAGES: [1, Infinity, true],
  MAX_STORED_MESSAGES: [1, Infinity, true],
  MAX_INPUT_CHARS: [500, Infinity, true],
  MAX_BATCH_MESSAGES: [1, Infinity, true],
  MAX_REQUESTS_PER_HOUR: [1, Infinity, true],
  RESPONSE_DELAY_MS: [0, Infinity, true],
  SIGNAL_STARTUP_VALIDATION_MS: [500, Infinity, true],
  AUDIO_FORWARD_MIN_SECONDS: [1, Infinity, true],
  OPENAI_TIMEOUT_MS: [1, 120000, true],
  OPENAI_MAX_OUTPUT_TOKENS: [128, 2048, true],
  HUMAN_ALERT_COOLDOWN_MINUTES: [0, Infinity, false],
  HUMAN_TAKEOVER_HOURS: [0.1, Infinity, false],
};

function cleanPhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!/^\d{8,15}$/.test(digits)) throw new Error(`Número inválido: ${value}`);
  return digits;
}

function phoneList(value, required = false) {
  const items = Array.isArray(value) ? value : String(value ?? "").split(/[\n,]/);
  const cleaned = [...new Set(items.map((item) => String(item).trim()).filter(Boolean).map(cleanPhone))];
  if (required && cleaned.length === 0) throw new Error("Debes configurar al menos un Encargado.");
  return cleaned;
}

function phoneListForDisplay(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.replace(/\D/g, ""))
    .filter(Boolean)
    .map((digits) => `+${digits}`);
}

function safeText(value, name, max = 200) {
  const text = String(value ?? "").trim();
  if (!text || text.length > max || /[\r\n\0]/.test(text)) throw new Error(`${name} no es válido`);
  return text;
}

export function readAdminConfig(envPath = ENV_PATH) {
  const current = fs.existsSync(envPath) ? dotenv.parse(fs.readFileSync(envPath)) : {};
  const support = current.HUMAN_SUPPORT_NUMBERS || current.HUMAN_SUPPORT_NUMBER || "";
  return {
    ...CONFIG_FIELDS,
    ...Object.fromEntries(Object.keys(CONFIG_FIELDS).map((key) => [key, current[key] ?? CONFIG_FIELDS[key]])),
    OPENAI_API_KEY: "",
    hasOpenAiApiKey: Boolean(current.OPENAI_API_KEY && current.OPENAI_API_KEY !== "sk-xxxxxxxx"),
    HUMAN_SUPPORT_NUMBERS: phoneListForDisplay(support),
    IGNORE_NUMBERS: phoneListForDisplay(current.IGNORE_NUMBERS),
  };
}

export function validateAdminConfig(input, existing = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Configuración inválida");
  const output = {};
  output.VAULT_PATH = safeText(input.VAULT_PATH, "VAULT_PATH", 500);
  output.BUSINESS_NAME = safeText(input.BUSINESS_NAME, "BUSINESS_NAME", 100);
  output.OPENAI_MODEL = safeText(input.OPENAI_MODEL, "OPENAI_MODEL");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,199}$/.test(output.OPENAI_MODEL)) throw new Error("OPENAI_MODEL no es válido");
  output.CONVERSATIONS_FOLDER = safeText(input.CONVERSATIONS_FOLDER, "CONVERSATIONS_FOLDER", 100);
  if ([".", ".."].includes(output.CONVERSATIONS_FOLDER) || /[\\/]/.test(output.CONVERSATIONS_FOLDER) || output.CONVERSATIONS_FOLDER.startsWith(".")) {
    throw new Error("CONVERSATIONS_FOLDER debe ser una carpeta simple");
  }
  for (const [key, [min, max, integer]] of Object.entries(NUMBER_RULES)) {
    const value = Number(input[key]);
    if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      throw new Error(`${key} debe ser ${integer ? "un entero" : "un número"} entre ${min} y ${max}`);
    }
    output[key] = String(value);
  }
  if (Number(output.MAX_STORED_MESSAGES) < Number(output.MAX_HISTORY_MESSAGES)) {
    throw new Error("MAX_STORED_MESSAGES no puede ser menor que MAX_HISTORY_MESSAGES");
  }
  const newKey = String(input.OPENAI_API_KEY ?? "").trim();
  output.OPENAI_API_KEY = newKey || existing.OPENAI_API_KEY || "";
  if (output.OPENAI_API_KEY === "sk-xxxxxxxx" || /[\r\n\0]/.test(output.OPENAI_API_KEY)) {
    throw new Error("La API key de OpenAI no es válida");
  }
  output.HUMAN_SUPPORT_NUMBERS = phoneList(input.HUMAN_SUPPORT_NUMBERS, true).join(",");
  output.IGNORE_NUMBERS = phoneList(input.IGNORE_NUMBERS).join(",");
  return output;
}

function serialize(config) {
  const groups = [
    ["# Rutas y negocio", "VAULT_PATH", "BUSINESS_NAME", "CONVERSATIONS_FOLDER"],
    ["# OpenAI", "OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_TIMEOUT_MS", "OPENAI_MAX_OUTPUT_TOKENS"],
    ["# Asistentes humanos y números ignorados", "HUMAN_SUPPORT_NUMBERS", "IGNORE_NUMBERS"],
    ["# Conversaciones", "CONVERSATION_EXPIRY_HOURS", "CONVERSATION_RETENTION_DAYS", "MAX_HISTORY_MESSAGES", "MAX_STORED_MESSAGES"],
    ["# Límites y tiempos", "MAX_INPUT_CHARS", "MAX_BATCH_MESSAGES", "MAX_REQUESTS_PER_HOUR", "RESPONSE_DELAY_MS", "SIGNAL_STARTUP_VALIDATION_MS", "AUDIO_FORWARD_MIN_SECONDS", "HUMAN_ALERT_COOLDOWN_MINUTES", "HUMAN_TAKEOVER_HOURS"],
  ];
  return `${groups.map(([title, ...keys]) => `${title}\n${keys.map((key) => `${key}=${config[key]}`).join("\n")}`).join("\n\n")}\n`;
}

export function saveAdminConfig(input, envPath = ENV_PATH, { backupRoot = DATA_ROOT, maxBackups = 10 } = {}) {
  const existing = fs.existsSync(envPath) ? dotenv.parse(fs.readFileSync(envPath)) : {};
  const config = validateAdminConfig(input, existing);
  if (fs.existsSync(envPath)) {
    const backupDir = path.join(backupRoot, ".local", "config-backups");
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.copyFileSync(envPath, path.join(backupDir, `${stamp}.env`));
    fs.chmodSync(path.join(backupDir, `${stamp}.env`), 0o600);
    const oldBackups = fs.readdirSync(backupDir)
      .filter((name) => name.endsWith(".env"))
      .sort()
      .slice(0, -maxBackups);
    for (const backup of oldBackups) fs.unlinkSync(path.join(backupDir, backup));
  }
  const temporary = `${envPath}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, serialize(config), { mode: 0o600 });
  fs.renameSync(temporary, envPath);
  fs.chmodSync(envPath, 0o600);
  return readAdminConfig(envPath);
}
