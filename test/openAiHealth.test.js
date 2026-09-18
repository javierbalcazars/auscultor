import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createOpenAiHealthChecker } from "../src/admin/openAiHealth.js";

function temporaryEnv(t, contents) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "openai-health-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const envPath = path.join(directory, ".env");
  fs.writeFileSync(envPath, contents, { mode: 0o600 });
  return envPath;
}

test("comprueba la clave y el modelo sin enviar conversaciones", async (t) => {
  const envPath = temporaryEnv(t, "OPENAI_API_KEY=sk-secreta\nOPENAI_MODEL=gpt-5-mini\n");
  let request;
  const checker = createOpenAiHealthChecker({
    envPath,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true };
    },
  });

  assert.equal(await checker.check(), true);
  assert.equal(request.url, "https://api.openai.com/v1/models/gpt-5-mini");
  assert.equal(request.options.headers.Authorization, "Bearer sk-secreta");
  assert.equal(request.options.method, undefined);
  assert.equal(request.options.body, undefined);
});

test("informa un fallo sin exponer la clave y reutiliza el resultado reciente", async (t) => {
  const envPath = temporaryEnv(t, "OPENAI_API_KEY=sk-no-mostrar\nOPENAI_MODEL=modelo-manual\n");
  let calls = 0;
  const checker = createOpenAiHealthChecker({
    envPath,
    fetchImpl: async () => {
      calls += 1;
      return { ok: false };
    },
  });

  assert.equal(await checker.check(), false);
  assert.equal(await checker.check(), false);
  assert.equal(calls, 1);
});

test("vuelve a comprobar OpenAI después de reiniciar la caché", async (t) => {
  const envPath = temporaryEnv(t, "OPENAI_API_KEY=sk-prueba\nOPENAI_MODEL=gpt-4o-mini\n");
  let calls = 0;
  const checker = createOpenAiHealthChecker({
    envPath,
    fetchImpl: async () => ({ ok: ++calls > 1 }),
  });

  assert.equal(await checker.check(), false);
  checker.reset();
  assert.equal(await checker.check(), true);
  assert.equal(calls, 2);
});
