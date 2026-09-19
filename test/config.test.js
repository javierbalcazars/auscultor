import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { APP_VERSION, loadOpenAIConfig, loadRuntimeConfig } from "../src/config.js";

function validEnvironment() {
  return {
    OPENAI_API_KEY: "sk-prueba",
    HUMAN_SUPPORT_NUMBER: "+56 9 1234 5678",
  };
}

function addValidFaq(vault) {
  const faqs = path.join(vault, "FAQs");
  fs.mkdirSync(faqs);
  fs.writeFileSync(path.join(faqs, "Información.md"), "# Información confirmada");
}

test("valida el límite de tokens, el tiempo de espera y el identificador del modelo", () => {
  const config = loadOpenAIConfig(validEnvironment());
  assert.equal(config.openAiMaxOutputTokens, 600);
  assert.equal(config.openAiTimeoutMs, 30000);
  assert.equal(config.openAiModel, "gpt-4o-mini");
  for (const value of ["", "abc", "30000ms", "0", "-1", "120001", "1.5"]) {
    assert.throws(() => loadOpenAIConfig({ ...validEnvironment(), OPENAI_TIMEOUT_MS: value }), /OPENAI_TIMEOUT_MS/);
  }
  for (const value of ["", "abc", "127", "2049", "600.5"]) {
    assert.throws(() => loadOpenAIConfig({ ...validEnvironment(), OPENAI_MAX_OUTPUT_TOKENS: value }), /OPENAI_MAX_OUTPUT_TOKENS/);
  }
  assert.throws(() => loadOpenAIConfig({ ...validEnvironment(), OPENAI_MODEL: "  " }), /OPENAI_MODEL/);
  assert.throws(() => loadOpenAIConfig({ ...validEnvironment(), OPENAI_MODEL: "modelo con espacios" }), /OPENAI_MODEL/);
});

test("expone la misma versión configurada en package.json", () => {
  const packageData = JSON.parse(
    fs.readFileSync(new URL("../package.json", import.meta.url), "utf-8")
  );
  assert.equal(APP_VERSION, packageData.version);
});

test("acepta una configuración segura y aplica valores predeterminados", (t) => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "whatsapp-bot-config-"));
  t.after(() => fs.rmSync(vault, { recursive: true, force: true }));
  addValidFaq(vault);
  const config = loadRuntimeConfig(validEnvironment(), vault);
  assert.equal(config.businessName, "Mi Negocio");
  assert.equal(config.responseDelayMs, 4000);
  assert.equal(config.signalStartupValidationMs, 3000);
  assert.equal(config.audioForwardMinSeconds, 10);
  assert.equal(config.conversationRetentionDays, 180);
  assert.equal(config.humanTakeoverMs, 2 * 60 * 60 * 1000);
  assert.equal(config.maxInputChars, 6000);
  assert.equal(config.maxHistoryMessages, 10);
  assert.equal(config.maxStoredMessages, 10);
  assert.deepEqual(config.humanSupportJids, ["56912345678@s.whatsapp.net"]);
});

test("acepta varios asistentes humanos y elimina duplicados", (t) => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "whatsapp-bot-config-"));
  t.after(() => fs.rmSync(vault, { recursive: true, force: true }));
  addValidFaq(vault);
  const config = loadRuntimeConfig({
    ...validEnvironment(),
    HUMAN_SUPPORT_NUMBER: "",
    HUMAN_SUPPORT_NUMBERS: "+56 9 1234 5678,56987654321,56912345678",
  }, vault);
  assert.deepEqual(config.humanSupportJids, [
    "56912345678@s.whatsapp.net",
    "56987654321@s.whatsapp.net",
  ]);
});

test("rechaza secretos ausentes, números inválidos y rutas inseguras", (t) => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "whatsapp-bot-config-"));
  t.after(() => fs.rmSync(vault, { recursive: true, force: true }));
  addValidFaq(vault);
  assert.throws(() => loadRuntimeConfig({ ...validEnvironment(), OPENAI_API_KEY: "" }, vault));
  assert.throws(() => loadRuntimeConfig({ ...validEnvironment(), HUMAN_SUPPORT_NUMBER: "" }, vault));
  assert.throws(() => loadRuntimeConfig({ ...validEnvironment(), BUSINESS_NAME: "   " }, vault));
  assert.throws(() => loadRuntimeConfig({ ...validEnvironment(), BUSINESS_NAME: "Nombre\ninyectado" }, vault));
  assert.throws(() => loadRuntimeConfig({ ...validEnvironment(), CONVERSATIONS_FOLDER: "../Chats" }, vault));
  assert.throws(() =>
    loadRuntimeConfig({ ...validEnvironment(), MAX_HISTORY_MESSAGES: "20", MAX_STORED_MESSAGES: "10" }, vault)
  );
});

test("rechaza un Vault sin documentos de preguntas frecuentes", (t) => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "whatsapp-bot-config-"));
  t.after(() => fs.rmSync(vault, { recursive: true, force: true }));

  assert.throws(
    () => loadRuntimeConfig(validEnvironment(), vault),
    /preguntas frecuentes/
  );

  fs.mkdirSync(path.join(vault, "FAQs"));
  assert.throws(
    () => loadRuntimeConfig(validEnvironment(), vault),
    /ningún documento Markdown/
  );
});
