import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as wait } from "node:timers/promises";

const port = 33210;
const baseUrl = `http://127.0.0.1:${port}`;

test("el servidor administrativo expone lecturas y protege acciones", async (t) => {
  const child = spawn(process.execPath, ["src/admin/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, ADMIN_PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  t.after(async () => {
    if (child.exitCode !== null) return;
    child.kill("SIGTERM");
    await once(child, "exit");
  });

  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/status`);
      if (response.ok) { ready = true; break; }
    } catch {
      await wait(50);
    }
  }
  assert.equal(ready, true, output);

  const configResponse = await fetch(`${baseUrl}/api/config`);
  const configBody = await configResponse.json();
  assert.equal(configResponse.status, 200);
  assert.equal(configBody.config.OPENAI_API_KEY, "");
  assert.equal(typeof configBody.csrfToken, "string");

  const page = await fetch(`${baseUrl}/`).then((response) => response.text());
  assert.match(page, /data-target="configuracion"/);
  assert.match(page, /id="generate-qr"/);
  assert.match(page, /id="cancel-qr"/);
  assert.match(page, /<input name="HUMAN_SUPPORT_NUMBERS" type="tel"/);
  assert.doesNotMatch(page, /<textarea name="HUMAN_SUPPORT_NUMBERS"/);
  assert.match(page, /Desvincular y generar QR nuevo/);
  assert.match(page, /Información del negocio/);
  assert.match(page, /Respaldo cifrado/);
  assert.doesNotMatch(page, /La sesión está vinculada y el bot puede recibir mensajes/);
  const iconResponse = await fetch(`${baseUrl}/icon.svg`);
  assert.equal(iconResponse.status, 200);
  assert.match(iconResponse.headers.get("content-type"), /image\/svg\+xml/);
  assert.match(await iconResponse.text(), /<svg/);

  const browserCode = await fetch(`${baseUrl}/app.js`).then((response) => response.text());
  assert.match(browserCode, /Bot encendido/);
  assert.match(browserCode, /Bot apagado/);
  assert.doesNotMatch(browserCode, /Bot conectado/);
  assert.match(browserCode, /Esperando escaneo de QR/);

  const faqsResponse = await fetch(`${baseUrl}/api/faqs`);
  const faqsBody = await faqsResponse.json();
  assert.equal(faqsResponse.status, 200);
  assert.ok(Array.isArray(faqsBody.documents));
  assert.ok(Array.isArray(faqsBody.templates));

  const toolsResponse = await fetch(`${baseUrl}/api/tools`);
  assert.equal(toolsResponse.status, 200);
  assert.ok(Array.isArray((await toolsResponse.json()).checks));

  const rejectedFaq = await fetch(`${baseUrl}/api/faqs`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "No autorizada.md", content: "# No" }),
  });
  assert.equal(rejectedFaq.status, 403);

  const rejected = await fetch(`${baseUrl}/api/bot/start`, { method: "POST" });
  assert.equal(rejected.status, 403);
  assert.deepEqual(await rejected.json(), { error: "Solicitud rechazada" });

  const rejectedReset = await fetch(`${baseUrl}/api/whatsapp/reset`, { method: "POST" });
  assert.equal(rejectedReset.status, 403);
  assert.deepEqual(await rejectedReset.json(), { error: "Solicitud rechazada" });

  const rejectedSetup = await fetch(`${baseUrl}/api/whatsapp/setup`, { method: "POST" });
  assert.equal(rejectedSetup.status, 403);
  assert.deepEqual(await rejectedSetup.json(), { error: "Solicitud rechazada" });

  const missing = await fetch(`${baseUrl}/ruta-inexistente`);
  assert.equal(missing.status, 404);
});
