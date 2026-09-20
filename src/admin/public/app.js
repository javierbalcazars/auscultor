const form = document.querySelector("#config-form");
const message = document.querySelector("#message");
const saveButton = document.querySelector("#save");
const modelSelect = document.querySelector("#model-select");
const manualModel = document.querySelector("#manual-model");
const modelHelp = document.querySelector("#model-help");
const startBotButton = document.querySelector("#start-bot");
const resetWhatsAppButton = document.querySelector("#reset-whatsapp");
const whatsappLink = document.querySelector("#whatsapp-link");
const qrView = document.querySelector("#qr-view");
const qrCode = document.querySelector("#qr-code");
const whatsappLed = document.querySelector("#whatsapp-led");
const openAiLed = document.querySelector("#openai-led");
const botProcessLed = document.querySelector("#bot-process-led");
const setupWelcome = document.querySelector("#setup-welcome");
const configActions = document.querySelector("#config-actions");
const faqList = document.querySelector("#faq-list");
const faqName = document.querySelector("#faq-name");
const faqContent = document.querySelector("#faq-content");
const faqMessage = document.querySelector("#faq-message");
const faqTemplate = document.querySelector("#faq-template");
const createBackupButton = document.querySelector("#create-backup");
const toolsMessage = document.querySelector("#tools-message");
const restoreBackupButton = document.querySelector("#restore-backup");
const backupSelect = document.querySelector("#backup-select");
let faqDocuments = [];
let faqTemplates = [];
let selectedFaq = null;
let csrfToken = "";
let botRunning = false;
const knownModels = new Set([
  "gpt-4o-mini",
  "gpt-5-nano",
  "gpt-5.4-nano",
  "gpt-4.1-mini",
  "gpt-5-mini",
  "gpt-5.4-mini",
  "gpt-4o",
  "gpt-4.1",
  "gpt-5",
]);
const modelDescriptions = {
  "gpt-4o-mini": "Modelo muy rápido y económico para consultas frecuentes.",
  "gpt-5-nano": "Modelo GPT-5 muy rápido para tareas simples y de gran volumen.",
  "gpt-5.4-nano": "Modelo GPT-5.4 rápido y económico para tareas sencillas.",
  "gpt-4.1-mini": "Buena velocidad con mayor capacidad que los modelos pequeños.",
  "gpt-5-mini": "Modelo rápido para tareas bien definidas y de alto volumen.",
  "gpt-5.4-mini": "Modelo moderno que combina velocidad y mayor capacidad.",
  "gpt-4o": "Equilibrio entre velocidad y capacidad.",
  "gpt-4.1": "Modelo potente para seguir instrucciones complejas.",
  "gpt-5": "Mayor capacidad para tareas complejas; puede responder más lento.",
  manual: "Escribe un identificador compatible con Chat Completions.",
};

function updateModelControl(selected, currentValue = "") {
  const manual = selected === "manual";
  modelSelect.value = selected;
  manualModel.classList.toggle("hidden", !manual);
  manualModel.value = manual ? currentValue : selected;
  modelHelp.textContent = modelDescriptions[selected];
}

function showMessage(text, error = false) {
  message.textContent = text;
  message.className = error ? "error" : "success";
}

function setEditingLocked(locked) {
  botRunning = locked;
  form.querySelectorAll("input:not([data-live-edit]), textarea:not([data-live-edit]), select:not([data-live-edit])").forEach((field) => {
    field.disabled = locked;
  });
  document.querySelector("#toggle-key").disabled = locked;
  saveButton.disabled = locked;
  form.classList.toggle("locked", locked);
  createBackupButton.disabled = locked;
  restoreBackupButton.disabled = locked;
  if (locked) showMessage("Detén el bot para modificar la configuración.", true);
  else if (message.textContent === "Detén el bot para modificar la configuración.") showMessage("");
}

function openPanel(panel) {
  if (!panel) return;
  document.querySelectorAll(".tabs button, .panel").forEach((item) => item.classList.remove("active"));
  panel.classList.add("active");
  document.querySelector(`.tabs button[data-target="${panel.id}"]`)?.classList.add("active");
  configActions.classList.toggle("hidden", ["faqs", "herramientas"].includes(panel.id));
}

function fill(config) {
  for (const [key, value] of Object.entries(config)) {
    const field = form.elements.namedItem(key);
    if (!field) continue;
    field.value = Array.isArray(value) ? value.join("\n") : value;
  }
  updateModelControl(knownModels.has(config.OPENAI_MODEL) ? config.OPENAI_MODEL : "manual", config.OPENAI_MODEL);
  document.querySelector("#key-help").textContent = config.hasOpenAiApiKey
    ? "Hay una clave guardada. Déjala vacía para conservarla."
    : "Aún no hay una clave válida guardada.";
}

modelSelect.addEventListener("change", () => updateModelControl(
  modelSelect.value,
  modelSelect.value === "manual" ? manualModel.value : modelSelect.value
));

async function load() {
  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    csrfToken = body.csrfToken;
    fill(body.config);
    setupWelcome.classList.toggle("hidden", !body.setupRequired);
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function updateBotStatus() {
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    const botLabel = botProcessLed.parentElement.querySelector("b");
    const botDetail = botProcessLed.parentElement.querySelector("small");
    botProcessLed.classList.remove("checking", "healthy", "unhealthy");
    if (body.running) {
      botProcessLed.classList.add("healthy");
      botLabel.textContent = "Bot encendido";
    } else {
      botProcessLed.classList.add("unhealthy");
      botLabel.textContent = "Bot apagado";
    }
    botDetail.textContent = "";
    startBotButton.disabled = false;
    startBotButton.textContent = body.running ? "Detener bot" : "Iniciar bot";
    whatsappLink.classList.toggle("hidden", body.state !== "qr");
    qrView.classList.toggle("hidden", body.state !== "qr");
    qrCode.textContent = body.qrDisplay || "";
    setEditingLocked(body.running);
    if (body.whatsappState === "linked") {
      setHealthIndicator(whatsappLed, true, "Sesión conectada", "Sesión no conectada");
    } else if (body.whatsappState === "qr" || body.whatsappState === "connecting") {
      whatsappLed.classList.remove("checking", "healthy", "unhealthy");
      whatsappLed.classList.add("checking");
      whatsappLed.parentElement.querySelector("small").textContent = body.whatsappState === "qr"
        ? "Esperando escaneo de QR"
        : "Iniciando sesión";
    } else {
      setHealthIndicator(whatsappLed, false, "Sesión conectada", "Sesión no conectada");
    }
  } catch {
    setHealthIndicator(botProcessLed, false, "Proceso iniciado", "No se pudo comprobar");
  }
}

function setHealthIndicator(element, valid, successText, failureText) {
  element.classList.remove("checking", "healthy", "unhealthy");
  element.classList.add(valid ? "healthy" : "unhealthy");
  element.parentElement.querySelector("small").textContent = valid ? successText : failureText;
}

async function updateHealth() {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setHealthIndicator(whatsappLed, body.whatsapp, "Sesión conectada", "Sesión no conectada");
    setHealthIndicator(openAiLed, body.openai, "Clave aceptada y modelo accesible", "Revisa la clave o el modelo");
  } catch {
    setHealthIndicator(whatsappLed, false, "Sesión conectada", "No se pudo comprobar");
    setHealthIndicator(openAiLed, false, "Clave aceptada y modelo accesible", "No se pudo comprobar");
  }
}

startBotButton.addEventListener("click", async () => {
  startBotButton.disabled = true;
  const action = botRunning ? "stop" : "start";
  startBotButton.textContent = action === "stop" ? "Deteniendo…" : "Iniciando…";
  showMessage(action === "stop" ? "Deteniendo el bot…" : "Iniciando el bot…");
  try {
    const response = await fetch(`/api/bot/${action}`, {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    showMessage(body.message);
    setTimeout(updateBotStatus, 1000);
  } catch (error) {
    showMessage(error.message, true);
    startBotButton.disabled = false;
    startBotButton.textContent = "Iniciar bot";
  }
});

resetWhatsAppButton.addEventListener("click", async () => {
  const confirmed = confirm("Se cerrará la sesión de WhatsApp en este equipo y tendrás que escanear un QR nuevo. ¿Continuar?");
  if (!confirmed) return;
  resetWhatsAppButton.disabled = true;
  showMessage("Desvinculando WhatsApp y preparando un QR nuevo…");
  try {
    const response = await fetch("/api/whatsapp/reset", {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    showMessage(body.message);
    setTimeout(updateBotStatus, 500);
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    resetWhatsAppButton.disabled = false;
  }
});

document.querySelectorAll(".tabs button").forEach((button) => button.addEventListener("click", () => {
  openPanel(document.querySelector(`#${button.dataset.target}`));
}));

form.addEventListener("invalid", (event) => {
  openPanel(event.target.closest(".panel"));
  showMessage(`Revisa el campo “${event.target.closest("label")?.querySelector("span")?.textContent || event.target.name}”.`, true);
}, true);

document.querySelector("#toggle-key").addEventListener("click", (event) => {
  const input = form.elements.OPENAI_API_KEY;
  input.type = input.type === "password" ? "text" : "password";
  event.currentTarget.textContent = input.type === "password" ? "Mostrar" : "Ocultar";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  saveButton.disabled = true;
  showMessage("Guardando…");
  const values = Object.fromEntries(new FormData(form));
  values.HUMAN_SUPPORT_NUMBERS = values.HUMAN_SUPPORT_NUMBERS.split("\n");
  values.IGNORE_NUMBERS = values.IGNORE_NUMBERS.split("\n");
  try {
    const response = await fetch("/api/config", { method: "PUT", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken }, body: JSON.stringify(values) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    form.elements.OPENAI_API_KEY.value = "";
    fill(body.config);
    setupWelcome.classList.add("hidden");
    showMessage(body.message);
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    saveButton.disabled = botRunning;
  }
});

load();
updateBotStatus();
updateHealth();
setInterval(updateBotStatus, 5000);


function showFaqMessage(text, error = false) {
  faqMessage.textContent = text;
  faqMessage.className = error ? "error" : "success";
}

function selectFaq(name) {
  const document = faqDocuments.find((item) => item.name === name);
  selectedFaq = document?.name || null;
  faqName.value = document?.name || "";
  faqContent.value = document?.content || "";
  document.querySelector("#delete-faq").disabled = !document;
  faqList.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.name === selectedFaq));
  showFaqMessage("");
}

function renderFaqs() {
  faqList.replaceChildren(...faqDocuments.map((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.name = item.name;
    button.textContent = item.name.replace(/\.md$/i, "");
    button.addEventListener("click", () => selectFaq(item.name));
    return button;
  }));
  if (selectedFaq && faqDocuments.some((item) => item.name === selectedFaq)) selectFaq(selectedFaq);
  else if (faqDocuments[0]) selectFaq(faqDocuments[0].name);
  else selectFaq(null);
}

async function loadFaqs() {
  try {
    const response = await fetch("/api/faqs", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    faqDocuments = body.documents;
    faqTemplates = body.templates;
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Usar plantilla…";
    const options = faqTemplates.map((template, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = template.name.replace(/\.md$/i, "");
      return option;
    });
    faqTemplate.replaceChildren(placeholder, ...options);
    renderFaqs();
  } catch (error) {
    showFaqMessage(error.message, true);
  }
}

document.querySelector("#new-faq").addEventListener("click", () => {
  selectedFaq = null;
  faqName.value = "Nueva información.md";
  faqContent.value = "# Nueva información\n\n";
  document.querySelector("#delete-faq").disabled = true;
  faqList.querySelectorAll("button").forEach((button) => button.classList.remove("active"));
  faqName.focus();
});

faqTemplate.addEventListener("change", () => {
  if (faqTemplate.value === "") return;
  const template = faqTemplates[Number(faqTemplate.value)];
  selectedFaq = null;
  faqName.value = template.name;
  faqContent.value = template.content;
  document.querySelector("#delete-faq").disabled = true;
  faqTemplate.value = "";
});

document.querySelector("#save-faq").addEventListener("click", async () => {
  showFaqMessage("Guardando…");
  try {
    const response = await fetch("/api/faqs", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ originalName: selectedFaq, name: faqName.value, content: faqContent.value }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    selectedFaq = body.document.name;
    await loadFaqs();
    showFaqMessage(body.message);
  } catch (error) {
    showFaqMessage(error.message, true);
  }
});

document.querySelector("#delete-faq").addEventListener("click", async () => {
  if (!selectedFaq || !confirm(`¿Eliminar “${selectedFaq}”? Se conservará un respaldo local.`)) return;
  try {
    const response = await fetch("/api/faqs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ name: selectedFaq }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    selectedFaq = null;
    await loadFaqs();
    showFaqMessage(body.message);
  } catch (error) {
    showFaqMessage(error.message, true);
  }
});

loadFaqs();


function toolResult(name, ok, detail) {
  const row = document.createElement("div");
  row.className = `tool-result ${ok ? "ok" : "bad"}`;
  const label = document.createElement("b");
  label.textContent = `${ok ? "OK" : "Revisar"} · ${name}`;
  const value = document.createElement("span");
  value.textContent = detail;
  row.append(label, value);
  return row;
}

async function loadTools() {
  try {
    const response = await fetch("/api/tools", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    document.querySelector("#diagnostic-results").replaceChildren(...body.checks.map((check) => toolResult(check.name, check.ok, check.detail)));
    const metricRows = [
      ["Desde", new Date(body.metrics.startedAt).toLocaleString()],
      ["Mensajes vistos", String(body.metrics.counters.messages_seen_by_baileys || 0)],
      ["Respuestas enviadas", String(body.metrics.counters.replies_sent || 0)],
      ["Derivaciones", String(body.metrics.counters.handoffs || 0)],
      ["Solicitudes a OpenAI", String(body.metrics.counters.openai_requests || 0)],
    ];
    document.querySelector("#metrics-results").replaceChildren(...metricRows.map(([name, detail]) => toolResult(name, true, detail)));
    const backupPlaceholder = document.createElement("option");
    backupPlaceholder.value = "";
    backupPlaceholder.textContent = "Respaldos disponibles…";
    const backupOptions = body.backups.map((backup) => {
      const option = document.createElement("option");
      option.value = backup.name;
      option.textContent = `${new Date(backup.updatedAt).toLocaleString()} · ${Math.ceil(backup.size / 1024)} KB`;
      return option;
    });
    backupSelect.replaceChildren(backupPlaceholder, ...backupOptions);
  } catch (error) {
    toolsMessage.textContent = error.message;
    toolsMessage.className = "error";
  }
}

document.querySelector("#refresh-tools").addEventListener("click", loadTools);
createBackupButton.addEventListener("click", async () => {
  const passphrase = document.querySelector("#backup-passphrase").value;
  toolsMessage.textContent = "Creando respaldo…";
  toolsMessage.className = "";
  try {
    const response = await fetch("/api/tools/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ passphrase }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    document.querySelector("#backup-passphrase").value = "";
    toolsMessage.textContent = body.message;
    toolsMessage.className = "success";
    await loadTools();
  } catch (error) {
    toolsMessage.textContent = error.message;
    toolsMessage.className = "error";
  }
});

loadTools();


restoreBackupButton.addEventListener("click", async () => {
  const name = backupSelect.value;
  const passphrase = document.querySelector("#backup-passphrase").value;
  if (!name) {
    toolsMessage.textContent = "Selecciona un respaldo.";
    toolsMessage.className = "error";
    return;
  }
  if (!confirm("La configuración, sesión, Vault y datos actuales serán reemplazados. Se creará un respaldo previo. ¿Continuar?")) return;
  toolsMessage.textContent = "Verificando y restaurando…";
  toolsMessage.className = "";
  try {
    const response = await fetch("/api/tools/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ name, passphrase, confirmed: true }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    document.querySelector("#backup-passphrase").value = "";
    toolsMessage.textContent = body.message;
    toolsMessage.className = "success";
    await Promise.all([load(), loadFaqs(), loadTools()]);
  } catch (error) {
    toolsMessage.textContent = error.message;
    toolsMessage.className = "error";
  }
});
