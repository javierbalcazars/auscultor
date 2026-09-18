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
  form.querySelectorAll("input, textarea, select").forEach((field) => {
    field.disabled = locked;
  });
  document.querySelector("#toggle-key").disabled = locked;
  saveButton.disabled = locked;
  form.classList.toggle("locked", locked);
  if (locked) showMessage("Detén el bot para modificar la configuración.", true);
  else if (message.textContent === "Detén el bot para modificar la configuración.") showMessage("");
}

function openPanel(panel) {
  if (!panel) return;
  document.querySelectorAll(".tabs button, .panel").forEach((item) => item.classList.remove("active"));
  panel.classList.add("active");
  document.querySelector(`.tabs button[data-target="${panel.id}"]`)?.classList.add("active");
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
