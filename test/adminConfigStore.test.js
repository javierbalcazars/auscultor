import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readAdminConfig, saveAdminConfig, validateAdminConfig } from "../src/admin/configStore.js";

function validInput() {
  return {
    VAULT_PATH: "./Vault", BUSINESS_NAME: "Alojamiento de prueba",
    OPENAI_API_KEY: "sk-prueba-segura", OPENAI_MODEL: "gpt-4o-mini",
    CONVERSATIONS_FOLDER: "Chats", CONVERSATION_EXPIRY_HOURS: "24",
    CONVERSATION_RETENTION_DAYS: "180", MAX_HISTORY_MESSAGES: "10",
    MAX_STORED_MESSAGES: "10", MAX_INPUT_CHARS: "6000", MAX_BATCH_MESSAGES: "20",
    MAX_REQUESTS_PER_HOUR: "30", RESPONSE_DELAY_MS: "4000",
    SIGNAL_STARTUP_VALIDATION_MS: "3000", AUDIO_FORWARD_MIN_SECONDS: "10",
    OPENAI_TIMEOUT_MS: "30000", OPENAI_MAX_OUTPUT_TOKENS: "600",
    HUMAN_ALERT_COOLDOWN_MINUTES: "60", HUMAN_TAKEOVER_HOURS: "2",
    HUMAN_SUPPORT_NUMBERS: ["+56 9 1234 5678", "56987654321"],
    IGNORE_NUMBERS: ["+56 9 1111 2222"],
  };
}

test("valida y normaliza la configuración administrable", () => {
  const result = validateAdminConfig(validInput());
  assert.equal(result.HUMAN_SUPPORT_NUMBERS, "56912345678,56987654321");
  assert.equal(result.IGNORE_NUMBERS, "56911112222");
  assert.equal(result.RESPONSE_DELAY_MS, "4000");
});

test("explica claramente cuando falta el encargado principal", () => {
  assert.throws(
    () => validateAdminConfig({ ...validInput(), HUMAN_SUPPORT_NUMBERS: [] }),
    { message: "Debes configurar al menos un Encargado." }
  );
});

test("conserva una API key existente cuando el formulario queda vacío", () => {
  const result = validateAdminConfig({ ...validInput(), OPENAI_API_KEY: "" }, { OPENAI_API_KEY: "sk-existente" });
  assert.equal(result.OPENAI_API_KEY, "sk-existente");
});

test("permite guardar la configuración sin API key para vincular WhatsApp", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "admin-config-no-key-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const envPath = path.join(directory, ".env");
  const result = validateAdminConfig({ ...validInput(), OPENAI_API_KEY: "" });
  assert.equal(result.OPENAI_API_KEY, "");
  saveAdminConfig({ ...validInput(), OPENAI_API_KEY: "" }, envPath);
  assert.equal(readAdminConfig(envPath).hasOpenAiApiKey, false);
});

test("guarda con permisos privados y nunca devuelve la API key", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "admin-config-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const envPath = path.join(directory, ".env");
  saveAdminConfig(validInput(), envPath);
  assert.equal(fs.statSync(envPath).mode & 0o777, 0o600);
  assert.match(fs.readFileSync(envPath, "utf8"), /OPENAI_API_KEY=sk-prueba-segura/);
  const visible = readAdminConfig(envPath);
  assert.equal(visible.OPENAI_API_KEY, "");
  assert.equal(visible.hasOpenAiApiKey, true);
  assert.deepEqual(visible.HUMAN_SUPPORT_NUMBERS, ["+56912345678", "+56987654321"]);
  assert.deepEqual(visible.IGNORE_NUMBERS, ["+56911112222"]);
});

test("rechaza límites inconsistentes y entradas con saltos de línea", () => {
  assert.throws(() => validateAdminConfig({ ...validInput(), MAX_STORED_MESSAGES: "2" }), /MAX_STORED_MESSAGES/);
  assert.throws(() => validateAdminConfig({ ...validInput(), BUSINESS_NAME: "Nombre\ninyectado" }), /BUSINESS_NAME/);
});

test("conserva solamente los diez respaldos más recientes", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "admin-backups-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const envPath = path.join(directory, ".env");
  saveAdminConfig(validInput(), envPath, { backupRoot: directory });
  const backupDirectory = path.join(directory, ".local", "config-backups");
  fs.mkdirSync(backupDirectory, { recursive: true });
  for (let index = 0; index < 12; index += 1) {
    const stamp = new Date(Date.now() + index).toISOString().replace(/[:.]/g, "-");
    fs.writeFileSync(path.join(backupDirectory, `${stamp}-${index}.env`), "respaldo", { mode: 0o600 });
    saveAdminConfig({ ...validInput(), BUSINESS_NAME: `Negocio ${index}` }, envPath, { backupRoot: directory });
  }
  const backups = fs.readdirSync(backupDirectory);
  assert.equal(backups.length, 10);
});
