import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const SOURCE_DIR = path.dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = path.resolve(SOURCE_DIR, "..");
export const ENV_PATH = path.join(PROJECT_ROOT, ".env");
export const APP_VERSION = JSON.parse(
  fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf-8")
).version;

// La configuración siempre se carga desde la raíz del proyecto, sin importar
// desde qué carpeta se haya ejecutado Node.
dotenv.config({ path: ENV_PATH });

export function resolveProjectPath(targetPath) {
  return path.isAbsolute(targetPath)
    ? targetPath
    : path.resolve(PROJECT_ROOT, targetPath);
}

export const AUTH_SESSION_PATH = resolveProjectPath("auth_session");
export const INSTANCE_LOCK_PATH = resolveProjectPath(".bot-instance.lock");
export const HUMAN_ALERTS_PATH = resolveProjectPath("data/pending-human-alerts.json");
export const VAULT_PATH = resolveProjectPath(
  process.env.VAULT_PATH || "Vault"
);
export const FAQS_PATH = path.join(VAULT_PATH, "FAQs");

function readNumber(environment, key, fallback, { integer = false, min = 0, max = Infinity } = {}) {
  const raw = environment[key] ?? String(fallback);
  const value = Number(raw);
  if (!String(raw).trim() || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`${key} debe ser un número ${integer ? "entero " : ""}entre ${min} y ${max}`);
  }
  return value;
}

function normalizeIgnoredJid(value) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes("@")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  return digits ? `${digits}@s.whatsapp.net` : null;
}

export function loadOpenAIConfig(environment = process.env) {
  const openAiApiKey = environment.OPENAI_API_KEY?.trim();
  if (!openAiApiKey || openAiApiKey === "sk-xxxxxxxx") {
    throw new Error("Falta configurar una OPENAI_API_KEY válida en .env");
  }

  const openAiModel = (environment.OPENAI_MODEL ?? "gpt-4o-mini").trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,199}$/.test(openAiModel)) {
    throw new Error("OPENAI_MODEL debe contener un identificador de modelo válido, sin espacios");
  }

  return {
    openAiApiKey,
    openAiModel,
    openAiTimeoutMs: readNumber(environment, "OPENAI_TIMEOUT_MS", 30000, {
      integer: true, min: 1, max: 120000,
    }),
    openAiMaxOutputTokens: readNumber(environment, "OPENAI_MAX_OUTPUT_TOKENS", 600, {
      integer: true, min: 128, max: 2048,
    }),
  };
}

export function loadRuntimeConfig(environment = process.env, vaultPath = VAULT_PATH) {
  loadOpenAIConfig(environment);

  const businessName = (environment.BUSINESS_NAME || "Mi Glamping").trim();
  if (!businessName || businessName.length > 100 || /[\r\n]/.test(businessName)) {
    throw new Error("BUSINESS_NAME debe contener un nombre de entre 1 y 100 caracteres, en una sola línea");
  }

  const humanSupportNumbers = (
    environment.HUMAN_SUPPORT_NUMBERS || environment.HUMAN_SUPPORT_NUMBER || ""
  ).split(",").map((number) => number.replace(/\D/g, "")).filter(Boolean);
  if (humanSupportNumbers.length === 0 || humanSupportNumbers.some((number) => !/^\d{8,15}$/.test(number))) {
    throw new Error("HUMAN_SUPPORT_NUMBERS debe contener uno o más números de 8 a 15 dígitos, incluido el código de país");
  }

  const conversationsFolder = environment.CONVERSATIONS_FOLDER || "Chats";
  if (
    conversationsFolder === "." ||
    conversationsFolder === ".." ||
    conversationsFolder.includes("/") ||
    conversationsFolder.includes("\\") ||
    conversationsFolder.startsWith(".")
  ) {
    throw new Error("CONVERSATIONS_FOLDER debe ser el nombre de una sola carpeta dentro del Vault");
  }

  if (!fs.existsSync(vaultPath) || !fs.statSync(vaultPath).isDirectory()) {
    throw new Error(`No existe el Vault configurado: ${vaultPath}`);
  }

  const faqsPath = path.join(vaultPath, "FAQs");
  if (!fs.existsSync(faqsPath) || !fs.statSync(faqsPath).isDirectory()) {
    throw new Error(`No existe la carpeta de preguntas frecuentes: ${faqsPath}`);
  }
  const faqDocuments = fs
    .readdirSync(faqsPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"));
  if (faqDocuments.length === 0) {
    throw new Error(`No existe ningún documento Markdown dentro de: ${faqsPath}`);
  }

  const maxHistoryMessages = readNumber(environment, "MAX_HISTORY_MESSAGES", 10, {
    integer: true,
    min: 1,
  });
  const maxStoredMessages = readNumber(environment, "MAX_STORED_MESSAGES", 10, {
    integer: true,
    min: 1,
  });
  if (maxStoredMessages < maxHistoryMessages) {
    throw new Error("MAX_STORED_MESSAGES no puede ser menor que MAX_HISTORY_MESSAGES");
  }

  return {
    businessName,
    ignoreNumbers: (environment.IGNORE_NUMBERS || "")
      .split(",")
      .map(normalizeIgnoredJid)
      .filter(Boolean),
    conversationsFolder,
    conversationExpiryHours: readNumber(environment, "CONVERSATION_EXPIRY_HOURS", 24, {
      min: 0.1,
    }),
    conversationRetentionDays: readNumber(environment, "CONVERSATION_RETENTION_DAYS", 180, {
      integer: true,
      min: 1,
      max: 3650,
    }),
    maxHistoryMessages,
    maxStoredMessages,
    maxInputChars: readNumber(environment, "MAX_INPUT_CHARS", 6000, {
      integer: true,
      min: 500,
    }),
    maxBatchMessages: readNumber(environment, "MAX_BATCH_MESSAGES", 20, {
      integer: true,
      min: 1,
    }),
    maxRequestsPerHour: readNumber(environment, "MAX_REQUESTS_PER_HOUR", 30, {
      integer: true,
      min: 1,
    }),
    responseDelayMs: readNumber(environment, "RESPONSE_DELAY_MS", 4000, {
      integer: true,
      min: 0,
    }),
    signalStartupValidationMs: readNumber(
      environment,
      "SIGNAL_STARTUP_VALIDATION_MS",
      3000,
      { integer: true, min: 500 }
    ),
    audioForwardMinSeconds: readNumber(environment, "AUDIO_FORWARD_MIN_SECONDS", 10, {
      integer: true,
      min: 1,
    }),
    humanSupportJids: [...new Set(humanSupportNumbers)].map((number) => `${number}@s.whatsapp.net`),
    humanAlertCooldownMs:
      readNumber(environment, "HUMAN_ALERT_COOLDOWN_MINUTES", 60, { min: 0 }) * 60 * 1000,
    humanTakeoverMs:
      readNumber(environment, "HUMAN_TAKEOVER_HOURS", 2, { min: 0.1 }) * 60 * 60 * 1000,
  };
}
