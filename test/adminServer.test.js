import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
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
  assert.match(configBody.version, /^\d+\.\d+\.\d+(?:-\d+)?$/);
  const packageMetadata = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(configBody.edition, packageMetadata.auscultorEdition);

  const page = await fetch(`${baseUrl}/`).then((response) => response.text());
  assert.match(page, /data-target="configuracion"/);
  assert.doesNotMatch(page, /id="app-version"/);
  assert.match(page, /data-target="info"/);
  assert.match(page, /id="info-version"/);
  assert.match(page, /id="app-edition"/);
  assert.match(page, /id="language-select"/);
  assert.match(page, /Javier Balcazar S\./);
  assert.doesNotMatch(page, /javierbalcazars@gmail\.com/);
  assert.match(page, /github\.com\/javierbalcazars\/auscultor\/issues/);
  assert.match(page, /src="\/api\/creator-avatar"/);
  assert.match(page, /width="160" height="160"/);
  assert.match(page, /Software de código abierto/);
  assert.match(page, /id="generate-qr"/);
  assert.match(page, /id="cancel-qr"/);
  assert.match(page, /<input name="HUMAN_SUPPORT_NUMBERS" type="tel"/);
  assert.doesNotMatch(page, /<textarea name="HUMAN_SUPPORT_NUMBERS"/);
  assert.match(page, /Desvincular y generar QR nuevo/);
  assert.match(page, /Información del negocio/);
  assert.match(page, /Respaldo cifrado/);
  assert.match(page, /placeholder="Pega aquí tu API key"/);
  assert.match(page, /id="backup-passphrase"[^>]*minlength="6"/);
  assert.ok(page.indexOf('id="avanzado"') < page.indexOf('id="backup-passphrase"'));
  assert.doesNotMatch(page, /La sesión está vinculada y el bot puede recibir mensajes/);
  const iconResponse = await fetch(`${baseUrl}/icon.svg`);
  assert.equal(iconResponse.status, 200);
  assert.match(iconResponse.headers.get("content-type"), /image\/svg\+xml/);
  assert.match(await iconResponse.text(), /<svg/);
  const browserCode = await fetch(`${baseUrl}/app.js`).then((response) => response.text());
  assert.doesNotMatch(browserCode, /appVersion\.textContent/);
  assert.match(browserCode, /infoVersion\.textContent = `v\$\{body\.version\}`/);
  assert.match(browserCode, /Bot encendido/);
  assert.match(browserCode, /Bot apagado/);
  assert.doesNotMatch(browserCode, /Bot conectado/);
  assert.match(browserCode, /Esperando escaneo de QR/);
  assert.match(browserCode, /No se pudo cargar la información del negocio\. Intenta nuevamente\./);
  assert.doesNotMatch(browserCode, /const document = faqDocuments/);
  const translations = await fetch(`${baseUrl}/i18n.js`).then((response) => response.text());
  assert.match(translations, /ASSISTANT SETTINGS/);
  assert.match(translations, /Save settings/);
  assert.match(translations, /auscultor-language/);

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
