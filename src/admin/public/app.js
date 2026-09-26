const form = document.querySelector("#config-form");
const authScreen = document.querySelector("#auth-screen");
const authForm = document.querySelector("#auth-form");
const authUsername = document.querySelector("#auth-username");
const authPassword = document.querySelector("#auth-password");
const authUserLabel = document.querySelector("#auth-user-label");
const authTitle = document.querySelector("#auth-title");
const authDescription = document.querySelector("#auth-description");
const authUserText = document.querySelector("#auth-user-text");
const welcomeUser = document.querySelector("#welcome-user");
const businessNameHeading = document.querySelector("#business-name-heading");
const authMessage = document.querySelector("#auth-message");
let authSetupRequired = false;
const infoVersion = document.querySelector("#info-version");
const appEdition = document.querySelector("#app-edition");
const languageSelect = document.querySelector("#language-select");
const i18n = globalThis.AuscultorI18n;
const message = document.querySelector("#message");
const saveButton = document.querySelector("#save");
const modelSelect = document.querySelector("#model-select");
const manualModel = document.querySelector("#manual-model");
const modelHelp = document.querySelector("#model-help");
const startBotButton = document.querySelector("#start-bot");
const resetWhatsAppButton = document.querySelector("#reset-whatsapp");
const generateQrButton = document.querySelector("#generate-qr");
const cancelQrButton = document.querySelector("#cancel-qr");
const generateQrAction = document.querySelector("#generate-qr-action");
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
const faqCount = document.querySelector("#faq-count");
const faqLayout = document.querySelector("#faq-layout");
const toggleFaqListButton = document.querySelector("#toggle-faq-list");
const faqSearch = document.querySelector("#faq-search");
const availabilityMonth = document.querySelector("#availability-month");
const availabilityDays = document.querySelector("#availability-days");
const availabilityStatus = document.querySelector("#availability-status");
const availabilityDetail = document.querySelector("#availability-detail");
const availabilityDetailDate = document.querySelector("#availability-detail-date");
const availabilityDetailText = document.querySelector("#availability-detail-text");
const availabilityListItems = document.querySelector("#availability-list-items");
const availabilityEditorHelp = document.querySelector("#availability-editor-help");
const availabilityEditState = document.querySelector("#availability-edit-state");
const availabilityEditClient = document.querySelector("#availability-edit-client");
const availabilityEditPayment = document.querySelector("#availability-edit-payment");
const availabilityEditNotes = document.querySelector("#availability-edit-notes");
const saveAvailabilityButton = document.querySelector("#save-availability");
const availabilityEditMessage = document.querySelector("#availability-edit-message");
const chatCount = document.querySelector("#chat-count");
const chatList = document.querySelector("#chat-list");
const chatPreviewEmpty = document.querySelector("#chat-preview-empty");
const chatPreviewContent = document.querySelector("#chat-preview-content");
const chatPreviewName = document.querySelector("#chat-preview-name");
const chatPreviewId = document.querySelector("#chat-preview-id");
const chatMessages = document.querySelector("#chat-messages");
const chatFirstMessage = document.querySelector("#chat-first-message");
const chatLastMessage = document.querySelector("#chat-last-message");
const chatStatus = document.querySelector("#chat-status");
const chatLock = document.querySelector("#chat-lock");
const chatsLayout = document.querySelector("#chats-layout");
const chatUnlockPassword = document.querySelector("#chat-unlock-password");
const unlockChatsButton = document.querySelector("#unlock-chats");
const chatLockMessage = document.querySelector("#chat-lock-message");
const dashboardReplies = document.querySelector("#dashboard-replies");
const dashboardSeen = document.querySelector("#dashboard-seen");
const dashboardHours = document.querySelector("#dashboard-hours");
const dashboardAvailability = document.querySelector("#dashboard-availability");
const dashboardOpenAi = document.querySelector("#dashboard-openai");
const availabilityUrlHelp = document.querySelector("#availability-url-help");
const availabilityEditUrlInput = form.elements.namedItem("AVAILABILITY_EDIT_URL");
const availabilityEditUrlHelp = document.querySelector("#availability-edit-url-help");
const keyHelp = document.querySelector("#key-help");
const availabilityUrlInput = form.elements.namedItem("AVAILABILITY_SHEET_URL");
const openAiKeyInput = form.elements.namedItem("OPENAI_API_KEY");
const createBackupButton = document.querySelector("#create-backup");
const toolsMessage = document.querySelector("#tools-message");
const customPrompt = document.querySelector("#custom-prompt");
const promptPassword = document.querySelector("#prompt-password");
const promptUnlockPassword = document.querySelector("#prompt-unlock-password");
const unlockPromptButton = document.querySelector("#unlock-prompt");
const promptLock = document.querySelector("#prompt-lock");
const promptEditorBody = document.querySelector("#prompt-editor-body");
const hidePromptButton = document.querySelector("#hide-prompt");
const promptMessage = document.querySelector("#prompt-message");
const promptResult = document.querySelector("#prompt-result");
const savePromptButton = document.querySelector("#save-prompt");
const resetWhatsAppPassword = document.querySelector("#reset-whatsapp-password");
const resetWhatsAppMessage = document.querySelector("#reset-whatsapp-message");
const promptConfirmModal = document.querySelector("#prompt-confirm-modal");
const cancelPromptChange = document.querySelector("#cancel-prompt-change");
const confirmPromptChange = document.querySelector("#confirm-prompt-change");
let promptHoldTimer = null;
let pendingConfirmationAction = "prompt";
const restoreBackupButton = document.querySelector("#restore-backup");
const backupSelect = document.querySelector("#backup-select");
const supportNumberInput = form.elements.namedItem("HUMAN_SUPPORT_NUMBERS");
let faqDocuments = [];
let selectedFaq = null;
let faqDirty = false;
let availabilityRecords = [];
let selectedAvailabilityDate = "";
let selectedAvailabilityUnit = "";
let chats = [];
let availabilityMonthDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let csrfToken = "";
let botRunning = false;
let configuration = { hasOpenAiApiKey: false, HUMAN_SUPPORT_NUMBERS: [] };
let configurationFingerprint = "";
let openAiReady = false;
let whatsappState = "unlinked";
let configurationOnly = false;
let adminUsername = "";

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
  message.textContent = i18n.t(text);
  message.className = error ? "error" : "success";
}

function setEditingLocked(locked) {
  botRunning = locked;
  form.querySelectorAll("input:not([data-live-edit]), textarea:not([data-live-edit]), select:not([data-live-edit])").forEach((field) => {
    field.disabled = locked;
  });
  document.querySelector("#toggle-key").disabled = locked;
  saveButton.disabled = false;
  form.classList.toggle("locked", locked);
  createBackupButton.disabled = locked;
  restoreBackupButton.disabled = locked;
  generateQrButton.disabled = locked;
  if (locked && !configurationOnly) showMessage("Detén el bot para modificar la configuración.", true);
  else if (message.textContent === "Detén el bot para modificar la configuración.") showMessage("");
  refreshStartButton();
  refreshSaveButton();
}

function formFingerprint() {
  const values = Object.fromEntries(new FormData(form));
  if (!values.OPENAI_API_KEY && configuration.hasOpenAiApiKey) values.OPENAI_API_KEY = "__stored__";
  return JSON.stringify(values);
}

function refreshSaveButton() {
  const dirty = Boolean(configurationFingerprint) && formFingerprint() !== configurationFingerprint;
  saveButton.classList.toggle("hidden", !dirty || botRunning);
  saveButton.disabled = false;
}

function hasSupportNumber() {
  const numbers = configuration.HUMAN_SUPPORT_NUMBERS;
  return (Array.isArray(numbers) ? numbers : String(numbers || "").split(/[\n,]/)).some((number) => String(number).replace(/\D/g, "").length >= 8);
}

function markSupportNumberRequired() {
  supportNumberInput.classList.add("field-error");
  openPanel(supportNumberInput.closest(".panel"));
  supportNumberInput.focus();
}

supportNumberInput.addEventListener("input", () => {
  if (supportNumberInput.value.replace(/\D/g, "").length >= 8) {
    supportNumberInput.classList.remove("field-error");
  }
});

function refreshStartButton() {
  const requirementsReady = configuration.hasOpenAiApiKey && openAiReady && hasSupportNumber() && whatsappState === "linked";
  startBotButton.textContent = i18n.t(botRunning && !configurationOnly ? "🤖 Detener bot" : "🤖 Iniciar bot");
  startBotButton.disabled = botRunning && !configurationOnly ? false : !(requirementsReady && (!botRunning || configurationOnly));
}

function openPanel(panel) {
  if (!panel) return;
  document.querySelectorAll(".tabs button, .panel").forEach((item) => item.classList.remove("active"));
  panel.classList.add("active");
  document.querySelector(`.tabs button[data-target="${panel.id}"]`)?.classList.add("active");
  configActions.classList.toggle("hidden", ["faqs", "disponibilidad", "reservas", "chats", "info", "avanzados"].includes(panel.id));
  if (panel.id === "reservas") loadAvailability();
  if (panel.id === "chats") resetChatLock();
  if (panel.id === "herramientas") loadTools();
}

function formatChatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(i18n.language === "en" ? "en-GB" : "es-CL", { dateStyle: "short", timeStyle: "short" });
}

function chatState(chat) {
  if (chat.awaitingHuman) return i18n.t("Atención humana");
  if (chat.isExpired) return i18n.t("Inactivo");
  if (chat.managedByBot) return i18n.t("Respondiendo el bot");
  return i18n.t("Sin automatización");
}

function resetChatLock() {
  chatLock.classList.remove("hidden");
  chatsLayout.classList.add("hidden");
  chatUnlockPassword.value = "";
  chatLockMessage.textContent = "";
  chatLockMessage.className = "";
}

function renderChat(chat) {
  if (!chat) {
    chatPreviewEmpty.classList.remove("hidden");
    chatPreviewContent.classList.add("hidden");
    return;
  }
  chatPreviewEmpty.classList.add("hidden");
  chatPreviewContent.classList.remove("hidden");
  chatPreviewName.textContent = chat.name;
  chatPreviewId.textContent = chat.id;
  chatFirstMessage.textContent = formatChatDate(chat.firstMessageAt);
  chatLastMessage.textContent = formatChatDate(chat.lastMessageAt);
  chatStatus.textContent = chatState(chat);
  chatStatus.className = chat.awaitingHuman ? "chat-state human" : chat.isExpired ? "chat-state inactive" : "chat-state bot";
  chatMessages.replaceChildren(...chat.history.map((turn) => {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${turn.role === "user" ? "incoming" : "outgoing"}`;
    const text = document.createElement("p");
    text.textContent = turn.content;
    const time = document.createElement("small");
    time.textContent = formatChatDate(turn.time);
    bubble.append(text, time);
    return bubble;
  }));
}

function renderChatList() {
  chatCount.textContent = i18n.t(`${chats.length} ${chats.length === 1 ? "conversación" : "conversaciones"}`);
  chatList.replaceChildren(...chats.map((chat, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chat-contact";
    const name = document.createElement("strong");
    name.textContent = chat.name;
    const summary = document.createElement("small");
    summary.textContent = `${chatState(chat)} · ${formatChatDate(chat.lastMessageAt)}`;
    button.append(name, summary);
    button.addEventListener("click", () => {
      document.querySelectorAll(".chat-contact.selected").forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
      renderChat(chat);
    });
    if (index === 0) setTimeout(() => button.click(), 0);
    return button;
  }));
  if (!chats.length) renderChat(null);
}

async function loadChats() {
  chatCount.textContent = i18n.t("Cargando…");
  try {
    const response = await fetch("/api/chats", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    chats = body.chats || [];
    renderChatList();
  } catch (error) {
    chats = [];
    chatCount.textContent = i18n.t("No disponible");
    chatList.replaceChildren();
    chatPreviewEmpty.textContent = i18n.t(error.message);
    renderChat(null);
  }
}

unlockChatsButton.addEventListener("click", async () => {
  chatLockMessage.textContent = "";
  chatLockMessage.className = "";
  const password = chatUnlockPassword.value;
  if (!password) {
    chatLockMessage.textContent = i18n.t("Ingresa la contraseña del administrador.");
    chatLockMessage.className = "error";
    chatUnlockPassword.focus();
    return;
  }
  unlockChatsButton.disabled = true;
  try {
    const response = await fetch("/api/prompt/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ password }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    chatLock.classList.add("hidden");
    chatsLayout.classList.remove("hidden");
    chatUnlockPassword.value = "";
    await loadChats();
  } catch (error) {
    chatLockMessage.textContent = i18n.t(error.message);
    chatLockMessage.className = "error";
  } finally {
    unlockChatsButton.disabled = false;
  }
});

chatUnlockPassword.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  unlockChatsButton.click();
});

function availabilityDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function syncAvailabilityEditorState() {
  const blocked = availabilityEditState.value === "bloqueado";
  const clientLabel = availabilityEditClient.closest("label");
  const paymentLabel = availabilityEditPayment.closest("label");
  clientLabel?.classList.toggle("hidden", blocked);
  paymentLabel?.classList.toggle("hidden", blocked);
  for (const field of [availabilityEditClient, availabilityEditPayment]) {
    field.disabled = blocked;
    field.readOnly = blocked;
    field.tabIndex = blocked ? -1 : 0;
    field.setAttribute("aria-disabled", String(blocked));
  }
  if (blocked) {
    availabilityEditClient.value = "";
    availabilityEditPayment.value = "";
  }
}

function renderAvailability() {
  availabilityMonth.textContent = availabilityMonthDate.toLocaleDateString(i18n.language === "en" ? "en-GB" : "es-CL", { month: "long", year: "numeric" });
  const year = availabilityMonthDate.getFullYear();
  const month = availabilityMonthDate.getMonth();
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const records = new Map(availabilityRecords.map((record) => [record.date, record]));
  const cells = [];
  for (let index = 0; index < 35; index += 1) {
    const date = new Date(year, month, index - offset + 1);
    const outside = date.getMonth() !== month;
    const key = availabilityDateKey(date);
    const record = records.get(key);
    const cell = document.createElement("button");
    cell.type = "button";
    const visualState = record?.state === "reservado" ? "reservado" : record?.state === "bloqueado" ? "bloqueado" : "available";
    cell.className = `availability-day${outside ? " outside" : ""} ${visualState}`;
    cell.disabled = outside;
    cell.dataset.date = key;
    cell.innerHTML = `<span>${date.getDate()}</span>`;
    if (record) cell.title = record.client || record.notes || record.state;
    cell.addEventListener("click", () => {
      availabilityDays.querySelectorAll(".availability-day.selected").forEach((selected) => selected.classList.remove("selected"));
      selectedAvailabilityDate = key;
      selectedAvailabilityUnit = record?.unit || "";
      availabilityEditState.value = record?.state || "disponible";
      availabilityEditClient.value = record?.client || "";
      const paymentMatch = record?.notes?.match(/(?:^| · )Pago:\s*([^·]*)/i);
      availabilityEditPayment.value = paymentMatch?.[1]?.trim() || "";
      availabilityEditNotes.value = record?.notes?.replace(/(?:^| · )Pago:\s*[^·]*/i, "").replace(/^ · | · $/g, "").trim() || "";
      syncAvailabilityEditorState();
      availabilityEditMessage.textContent = "";
      saveAvailabilityButton.disabled = false;
      availabilityEditorHelp.textContent = `${i18n.t("Editando")} ${new Date(`${key}T00:00:00`).toLocaleDateString(i18n.language === "en" ? "en-GB" : "es-CL", { dateStyle: "long" })}.`;
      if (!record) { availabilityDetail.classList.add("hidden"); return; }
      cell.classList.add("selected");
      availabilityDetail.classList.remove("hidden");
      availabilityDetailDate.textContent = new Date(`${record.date}T00:00:00`).toLocaleDateString(i18n.language === "en" ? "en-GB" : "es-CL", { dateStyle: "long" });
      const observation = record.notes?.replace(/(?:^| · )Pago:\s*[^·]*/i, "").replace(/^ · | · $/g, "").trim() || "";
      availabilityDetailText.textContent = observation ? i18n.t(`Observación: ${observation}`) : i18n.t("Sin observaciones.");
    });
    cells.push(cell);
  }
  availabilityDays.replaceChildren(...cells);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
  const unavailableRecords = availabilityRecords.filter((record) => record.date.startsWith(monthPrefix) && ["reservado", "bloqueado"].includes(record.state));
  const unavailable = unavailableRecords.length;
  dashboardAvailability.textContent = `${Math.max(0, Math.round(((daysInMonth - unavailable) / daysInMonth) * 100))}%`;
  const listRows = unavailableRecords.map((record) => {
    const row = document.createElement("div");
    row.className = `availability-list-row ${record.state}`;
    const date = document.createElement("strong");
    date.textContent = new Date(`${record.date}T00:00:00`).toLocaleDateString(i18n.language === "en" ? "en-GB" : "es-CL", { day: "numeric", month: "short" });
      const details = document.createElement("span");
      const paymentMatch = record.notes?.match(/(?:^| · )Pago:\s*([^·]*)/i);
      const payment = paymentMatch?.[1]?.trim() || "";
      const observation = record.notes?.replace(/(?:^| · )Pago:\s*[^·]*/i, "").replace(/^ · | · $/g, "").trim() || "";
      details.textContent = [i18n.t(record.state === "reservado" ? "Reservado" : "Bloqueado"), record.client, payment ? i18n.t(`Pago: ${payment}`) : "", record.state === "bloqueado" && observation ? observation : ""].filter(Boolean).join(" · ");
    row.append(date, details);
    return row;
  });
  availabilityListItems.replaceChildren(...listRows);
  if (!listRows.length) {
    const empty = document.createElement("p");
    empty.className = "availability-list-empty";
    empty.textContent = i18n.t("No hay reservas ni bloqueos en este mes.");
    availabilityListItems.append(empty);
  }
}

availabilityEditState.addEventListener("change", syncAvailabilityEditorState);

saveAvailabilityButton.addEventListener("click", async () => {
  if (!selectedAvailabilityDate) return;
  saveAvailabilityButton.disabled = true;
  availabilityEditMessage.textContent = i18n.t("Guardando…");
  availabilityEditMessage.className = "";
  try {
    const response = await fetch("/api/availability/update", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ date: selectedAvailabilityDate, unit: selectedAvailabilityUnit, state: availabilityEditState.value, client: availabilityEditClient.value, payment: availabilityEditPayment.value, notes: availabilityEditNotes.value }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    availabilityEditMessage.textContent = i18n.t(body.message);
    availabilityEditMessage.className = "success";
    await loadAvailability();
  } catch (error) {
    availabilityEditMessage.textContent = i18n.t(error.message);
    availabilityEditMessage.className = "error";
  } finally {
    saveAvailabilityButton.disabled = !selectedAvailabilityDate;
  }
});

async function loadAvailability() {
  availabilityStatus.textContent = i18n.t("Consultando disponibilidad…");
  try {
    const response = await fetch("/api/availability", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    availabilityRecords = body.records;
    const updatedLabel = body.updatedAt
      ? `${i18n.t("Última actualización:")} ${new Date(body.updatedAt).toLocaleString(i18n.language === "en" ? "en-GB" : "es-CL", { dateStyle: "short", timeStyle: "short" })}`
      : "";
    availabilityStatus.textContent = [i18n.t(body.message), updatedLabel].filter(Boolean).join(" · ");
    availabilityStatus.className = `availability-status ${body.source === "error" ? "error" : body.source === "cache" ? "stale" : ""}`;
    renderAvailability();
  } catch (error) {
    availabilityRecords = [];
    availabilityStatus.textContent = i18n.t(error.message);
    availabilityStatus.className = "availability-status error";
    renderAvailability();
  }
}

document.querySelector("#availability-prev").addEventListener("click", () => {
  availabilityMonthDate = new Date(availabilityMonthDate.getFullYear(), availabilityMonthDate.getMonth() - 1, 1);
  renderAvailability();
});
document.querySelector("#availability-next").addEventListener("click", () => {
  availabilityMonthDate = new Date(availabilityMonthDate.getFullYear(), availabilityMonthDate.getMonth() + 1, 1);
  renderAvailability();
});
document.querySelector("#availability-refresh").addEventListener("click", loadAvailability);

function fill(config) {
  businessNameHeading.textContent = config.BUSINESS_NAME || "Auscultor";
  for (const [key, value] of Object.entries(config)) {
    if (["AVAILABILITY_SHEET_URL", "AVAILABILITY_EDIT_URL"].includes(key)) continue;
    const field = form.elements.namedItem(key);
    if (!field) continue;
    field.value = Array.isArray(value) ? value.join("\n") : value;
  }
  const hasAvailabilityUrl = Boolean(config.AVAILABILITY_SHEET_URL);
  availabilityUrlInput.placeholder = hasAvailabilityUrl ? "Ya hay un link válido. Pega un link nuevo para editar." : "Pega aquí tu link de Sheets";
  availabilityUrlHelp.textContent = hasAvailabilityUrl ? "" : "Se guarda de forma privada en .env.";
  const hasAvailabilityEditUrl = Boolean(config.AVAILABILITY_EDIT_URL);
  availabilityEditUrlInput.placeholder = hasAvailabilityEditUrl ? "Ya hay un link válido. Pega un link nuevo para editar." : "Pega aquí tu link de Apps Script";
  availabilityEditUrlHelp.textContent = hasAvailabilityEditUrl ? "" : "Se guarda de forma privada en .env.";
  openAiKeyInput.placeholder = config.hasOpenAiApiKey ? "Ya hay una clave válida. Pega una API key nueva para editar." : "Pega aquí tu API key";
  keyHelp.textContent = config.hasOpenAiApiKey ? "" : "Pega aquí tu API key privada de OpenAI.";
  const supportNumbers = Array.isArray(config.HUMAN_SUPPORT_NUMBERS)
    ? config.HUMAN_SUPPORT_NUMBERS
    : String(config.HUMAN_SUPPORT_NUMBERS || "").split(/[\n,]/).filter(Boolean);
  form.elements.namedItem("HUMAN_SUPPORT_NUMBERS").value = supportNumbers[0] || "";
  form.elements.namedItem("ADDITIONAL_SUPPORT_NUMBERS").value = supportNumbers.slice(1).join("\n");
  const responseDelayMilliseconds = Number(config.RESPONSE_DELAY_MS);
  form.elements.namedItem("RESPONSE_DELAY_MS").value = Number.isFinite(responseDelayMilliseconds)
    ? responseDelayMilliseconds / 1000
    : "";
  configuration = config;
  refreshStartButton();
  updateModelControl(knownModels.has(config.OPENAI_MODEL) ? config.OPENAI_MODEL : "manual", config.OPENAI_MODEL);
  document.querySelector("#key-help").textContent = config.hasOpenAiApiKey
    ? "Hay una clave guardada. Déjala vacía para conservarla."
    : "Aún no hay una clave válida guardada.";
  configurationFingerprint = formFingerprint();
  refreshSaveButton();
}

modelSelect.addEventListener("change", () => updateModelControl(
  modelSelect.value,
  modelSelect.value === "manual" ? manualModel.value : modelSelect.value
));
form.addEventListener("input", refreshSaveButton);
form.addEventListener("change", refreshSaveButton);

async function load() {
  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    csrfToken = body.csrfToken;
    infoVersion.textContent = `v${body.version}`;
    appEdition.textContent = body.edition === "stable" ? "Estable" : "Experimental";
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
    whatsappState = body.whatsappState;
    configurationOnly = body.running && body.configurationOnly === true;
    if (!body.running || configurationOnly) {
      botProcessLed.classList.add("unhealthy");
      botLabel.textContent = i18n.t("Bot apagado");
    } else {
      botProcessLed.classList.add("healthy");
      botLabel.textContent = i18n.t("Bot encendido");
    }
    botDetail.textContent = "";
    generateQrAction.classList.toggle("hidden", body.running || body.whatsappState === "linked");
    whatsappLink.classList.toggle("hidden", body.state !== "qr");
    qrView.classList.toggle("hidden", body.state !== "qr");
    qrCode.textContent = body.qrDisplay || "";
    setEditingLocked(body.running);
    refreshStartButton();
    if (body.whatsappState === "linked") {
    setHealthIndicator(whatsappLed, true, "Sesión conectada", "Sesión no conectada");
    } else if (body.whatsappState === "qr" || body.whatsappState === "connecting") {
      whatsappLed.classList.remove("checking", "healthy", "unhealthy");
      whatsappLed.classList.add("checking");
      whatsappLed.parentElement.querySelector("small").textContent = i18n.t(body.whatsappState === "qr"
        ? "Esperando escaneo de QR"
        : "Iniciando sesión");
    } else {
      setHealthIndicator(whatsappLed, false, "Sesión conectada", "Sesión no conectada");
    }
  } catch {
    setHealthIndicator(botProcessLed, false, "Proceso iniciado", "No se pudo comprobar");
    startBotButton.disabled = true;
  }
}

function setHealthIndicator(element, valid, successText, failureText) {
  element.classList.remove("checking", "healthy", "unhealthy");
  element.classList.add(valid ? "healthy" : "unhealthy");
  element.parentElement.querySelector("small").textContent = i18n.t(valid ? successText : failureText);
}

async function updateHealth() {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    openAiReady = body.openai;
    refreshStartButton();
    setHealthIndicator(whatsappLed, body.whatsapp, "Sesión conectada", "Sesión no conectada");
    setHealthIndicator(openAiLed, body.openai, "Clave aceptada y modelo accesible", "Revisa la clave o el modelo");
  } catch {
    setHealthIndicator(whatsappLed, false, "Sesión conectada", "No se pudo comprobar");
    setHealthIndicator(openAiLed, false, "Clave aceptada y modelo accesible", "No se pudo comprobar");
  }
}

startBotButton.addEventListener("click", async () => {
  startBotButton.disabled = true;
  const action = botRunning && !configurationOnly ? "stop" : "start";
    startBotButton.textContent = i18n.t(action === "stop" ? "Deteniendo…" : "Iniciando…");
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
    startBotButton.textContent = i18n.t("🤖 Iniciar bot");
  }
});

resetWhatsAppButton.addEventListener("click", async () => {
  resetWhatsAppMessage.textContent = "";
  const password = resetWhatsAppPassword.value;
  if (!password) {
    resetWhatsAppMessage.textContent = i18n.t("Ingresa la contraseña del administrador.");
    resetWhatsAppMessage.className = "prompt-error";
    return;
  }
  try {
    const verify = await fetch("/api/prompt/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ password }),
    });
    const verifyBody = await verify.json();
    if (!verify.ok) throw new Error(verifyBody.error);
  } catch (error) {
    resetWhatsAppMessage.textContent = i18n.t(error.message);
    resetWhatsAppMessage.className = "prompt-error";
    return;
  }
  pendingConfirmationAction = "whatsapp";
  document.querySelector("#prompt-confirm-title").textContent = i18n.t("¿Confirmar desvinculación de WhatsApp?");
  document.querySelector("#prompt-confirm-modal p").textContent = i18n.t("La sesión se eliminará y tendrás que escanear un QR nuevo.");
  promptConfirmModal.classList.remove("hidden");
  resetWhatsAppButton.disabled = true;
});

document.querySelectorAll(".tabs button").forEach((button) => button.addEventListener("click", () => {
  const leavingFaqEditor = document.querySelector("#faqs").classList.contains("active") && button.dataset.target !== "faqs";
  if (leavingFaqEditor && !canDiscardFaqChanges()) return;
  if (leavingFaqEditor && faqDirty) selectFaq(selectedFaq);
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

function readFormValues() {
  const values = Object.fromEntries(new FormData(form));
  const responseDelaySeconds = Number(String(values.RESPONSE_DELAY_MS).replace(",", "."));
  if (!Number.isFinite(responseDelaySeconds) || responseDelaySeconds < 0) {
    throw new Error("Ingresa un tiempo de respuesta válido en segundos.");
  }
  values.RESPONSE_DELAY_MS = String(Math.round(responseDelaySeconds * 1000));
  values.HUMAN_SUPPORT_NUMBERS = [values.HUMAN_SUPPORT_NUMBERS, ...values.ADDITIONAL_SUPPORT_NUMBERS.split("\n")].filter(Boolean);
  values.IGNORE_NUMBERS = values.IGNORE_NUMBERS.split("\n");
  return values;
}

async function saveConfiguration() {
  const response = await fetch("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    body: JSON.stringify(readFormValues()),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error);
  configuration = body.config;
  await updateHealth();
  return body;
}

generateQrButton.addEventListener("click", async () => {
  generateQrButton.disabled = true;
  showMessage("Guardando configuración e iniciando WhatsApp…");
  try {
    await saveConfiguration();
    const response = await fetch("/api/whatsapp/setup", {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    showMessage(body.message);
    setTimeout(updateBotStatus, 1000);
  } catch (error) {
    if (error.message === "Debes configurar al menos un Encargado.") markSupportNumberRequired();
    showMessage(error.message, true);
  } finally {
    generateQrButton.disabled = false;
  }
});

cancelQrButton.addEventListener("click", async () => {
  cancelQrButton.disabled = true;
  showMessage("Cancelando la vinculación de WhatsApp…");
  try {
    const response = await fetch("/api/bot/stop", {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    showMessage("Vinculación cancelada.");
    await updateBotStatus();
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    cancelQrButton.disabled = false;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  saveButton.disabled = true;
  showMessage("Guardando…");
  try {
    const body = await saveConfiguration();
    form.elements.OPENAI_API_KEY.value = "";
    fill(body.config);
    setupWelcome.classList.add("hidden");
    showMessage(body.message);
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    refreshSaveButton();
  }
});

async function authenticate() {
  const status = await fetch("/api/auth/status").then((response) => response.json());
  authSetupRequired = status.setupRequired;
  authTitle.textContent = authSetupRequired ? i18n.t("¿Cómo quieres que te llamemos?") : "Auscultor";
  authDescription.textContent = i18n.t(authSetupRequired ? "Configura una clave de administrador para proteger Auscultor." : "Ingresa tu contraseña para abrir el panel.");
  authUserText.textContent = i18n.t(authSetupRequired ? "Nombre de usuario" : "Usuario");
  authUserLabel.classList.toggle("hidden", !authSetupRequired);
  authUsername.required = authSetupRequired;
  authUsername.value = authSetupRequired ? "" : status.username;
  adminUsername = status.username || "";
  updateWelcomeUser();
  authPassword.autocomplete = authSetupRequired ? "new-password" : "current-password";
  authScreen.classList.remove("hidden");
}

function updateWelcomeUser() {
  welcomeUser.textContent = adminUsername ? `${i18n.t("Bienvenido nuevamente")}, ${adminUsername}` : i18n.t("Bienvenido nuevamente");
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authMessage.textContent = "";
  try {
    const endpoint = authSetupRequired ? "/api/auth/setup" : "/api/auth/login";
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: authUsername.value, password: authPassword.value }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    authScreen.classList.add("hidden");
    await load();
    // Las rutas protegidas no pueden consultarse antes del login. Actualiza
    // salud y estado ahora que la sesión ya está autenticada para que el
    // botón de inicio refleje la API key realmente configurada.
    await Promise.all([updateHealth(), updateBotStatus()]);
    await loadAvailability();
    await loadFaqs();
    await loadTools();
    await loadPrompt();
  } catch (error) { authMessage.textContent = i18n.t(error.message); }
});

authenticate();
updateBotStatus();
updateHealth();
setInterval(updateBotStatus, 5000);


function showFaqMessage(text, error = false, pending = false) {
  faqMessage.textContent = i18n.t(text);
  faqMessage.className = error ? "error" : pending ? "pending" : "success";
}

function displayFaqName(name) {
  return String(name || "").replace(/\.md$/i, "");
}

function storedFaqName(name) {
  const title = displayFaqName(name).trim();
  if (!title) throw new Error("Escribe un título para esta información.");
  return `${title}.md`;
}

function markFaqDirty() {
  faqDirty = true;
  showFaqMessage("Cambios sin guardar.", false, true);
}

function canDiscardFaqChanges() {
  return !faqDirty || confirm(i18n.t("Hay cambios sin guardar. ¿Quieres descartarlos?"));
}

function selectFaq(name) {
  const faqDocument = faqDocuments.find((item) => item.name === name);
  selectedFaq = faqDocument?.name || null;
  faqName.value = displayFaqName(faqDocument?.name);
  faqContent.value = faqDocument?.content || "";
  faqDirty = false;
  document.querySelector("#delete-faq").disabled = !faqDocument;
  faqList.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.name === selectedFaq));
  showFaqMessage("");
}

function updateFaqCount() {
  faqCount.textContent = i18n.language === "en"
    ? `${faqDocuments.length} available topic${faqDocuments.length === 1 ? "" : "s"}`
    : `${faqDocuments.length} tema${faqDocuments.length === 1 ? "" : "s"} disponible${faqDocuments.length === 1 ? "" : "s"}`;
}

function formatFaqDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(i18n.language === "en" ? "en-GB" : "es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function renderFaqs() {
  const query = faqSearch.value.trim().toLocaleLowerCase(i18n.language === "en" ? "en" : "es");
  const visibleDocuments = faqDocuments.filter((item) => displayFaqName(item.name)
    .toLocaleLowerCase(i18n.language === "en" ? "en" : "es")
    .includes(query));
  const buttons = visibleDocuments.map((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.name = item.name;
    button.classList.toggle("active", item.name === selectedFaq);
    const title = document.createElement("span");
    title.textContent = displayFaqName(item.name);
    const updated = document.createElement("small");
    updated.textContent = formatFaqDate(item.updatedAt);
    button.append(title, updated);
    button.addEventListener("click", () => {
      if (item.name !== selectedFaq && canDiscardFaqChanges()) selectFaq(item.name);
    });
    return button;
  });
  if (buttons.length === 0) {
    const empty = document.createElement("p");
    empty.className = "faq-empty";
    empty.textContent = query ? i18n.t("No se encontraron temas.") : i18n.t("Aún no hay temas.");
    faqList.replaceChildren(empty);
  } else faqList.replaceChildren(...buttons);
  updateFaqCount();
}

async function loadFaqs() {
  try {
    const response = await fetch("/api/faqs", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    faqDocuments = body.documents;
    renderFaqs();
    if (selectedFaq && faqDocuments.some((item) => item.name === selectedFaq)) selectFaq(selectedFaq);
    else if (faqDocuments[0]) selectFaq(faqDocuments[0].name);
    else selectFaq(null);
  } catch {
    showFaqMessage("No se pudo cargar la información del negocio. Intenta nuevamente.", true);
  }
}

document.querySelector("#new-faq").addEventListener("click", () => {
  if (!canDiscardFaqChanges()) return;
  selectedFaq = null;
  faqName.value = "Nueva información";
  faqContent.value = "# Nueva información\n\n";
  markFaqDirty();
  document.querySelector("#delete-faq").disabled = true;
  faqList.querySelectorAll("button").forEach((button) => button.classList.remove("active"));
  faqName.focus();
});

faqName.addEventListener("input", markFaqDirty);
faqContent.addEventListener("input", markFaqDirty);
faqSearch.addEventListener("input", renderFaqs);

toggleFaqListButton.addEventListener("click", () => {
  const collapsed = faqLayout.classList.toggle("list-collapsed");
  toggleFaqListButton.setAttribute("aria-expanded", String(!collapsed));
  toggleFaqListButton.textContent = collapsed ? "Mostrar lista" : "Ocultar lista";
});

document.querySelector("#save-faq").addEventListener("click", async () => {
  showFaqMessage("Guardando…");
  try {
    const name = storedFaqName(faqName.value);
    const title = displayFaqName(name);
    const lines = faqContent.value.replace(/\r\n/g, "\n").split("\n");
    const firstContentLine = lines.findIndex((line) => line.trim());
    if (firstContentLine >= 0 && /^#\s+/.test(lines[firstContentLine])) lines[firstContentLine] = `# ${title}`;
    else lines.unshift(`# ${title}`, "");
    const response = await fetch("/api/faqs", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ originalName: selectedFaq, name, content: lines.join("\n") }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    selectedFaq = body.document.name;
    faqDirty = false;
    await loadFaqs();
    showFaqMessage(body.message);
  } catch (error) {
    showFaqMessage(error.message, true);
  }
});

document.querySelector("#delete-faq").addEventListener("click", async () => {
  if (!selectedFaq || !confirm(i18n.t(`¿Eliminar “${displayFaqName(selectedFaq)}”? Se conservará un respaldo local.`))) return;
  try {
    const response = await fetch("/api/faqs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ name: selectedFaq }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    selectedFaq = null;
    faqDirty = false;
    await loadFaqs();
    showFaqMessage(body.message);
  } catch (error) {
    showFaqMessage(error.message, true);
  }
});

loadFaqs();

globalThis.addEventListener("beforeunload", (event) => {
  if (!faqDirty) return;
  event.preventDefault();
  event.returnValue = "";
});


function toolResult(name, ok, detail) {
  const row = document.createElement("div");
  row.className = `tool-result ${ok ? "ok" : "bad"}`;
  const label = document.createElement("b");
  label.textContent = `${ok ? "OK" : i18n.t("Revisar")} · ${i18n.t(name)}`;
  const value = document.createElement("span");
  value.textContent = i18n.t(detail);
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
      ["Desde", new Date(body.metrics.startedAt).toLocaleString(i18n.language === "en" ? "en-GB" : "es-CL")],
      ["Mensajes vistos", String(body.metrics.counters.messages_seen_by_baileys || 0)],
      ["Respuestas enviadas", String(body.metrics.counters.replies_sent || 0)],
      ["Derivaciones", String(body.metrics.counters.handoffs || 0)],
      ["Solicitudes a OpenAI", String(body.metrics.counters.openai_requests || 0)],
    ];
    document.querySelector("#metrics-results").replaceChildren(...metricRows.map(([name, detail]) => toolResult(name, true, detail)));
    dashboardReplies.textContent = String(body.metrics.counters.replies_sent || 0);
    dashboardSeen.textContent = String(body.metrics.counters.messages_seen_by_baileys || 0);
    dashboardOpenAi.textContent = String(body.metrics.counters.openai_requests || 0);
    dashboardHours.textContent = Number.isFinite(Number(body.metrics.runtimeMs))
      ? `${(Number(body.metrics.runtimeMs) / 3_600_000).toFixed(1)} h`
      : "—";
    const backupPlaceholder = document.createElement("option");
    backupPlaceholder.value = "";
    backupPlaceholder.textContent = i18n.t("Respaldos disponibles…");
    const backupOptions = body.backups.map((backup) => {
      const option = document.createElement("option");
      option.value = backup.name;
      option.textContent = `${new Date(backup.updatedAt).toLocaleString()} · ${Math.ceil(backup.size / 1024)} KB`;
      return option;
    });
    backupSelect.replaceChildren(backupPlaceholder, ...backupOptions);
  } catch (error) {
    toolsMessage.textContent = i18n.t(error.message);
    toolsMessage.className = "error";
  }
}

async function loadPrompt() {
  promptEditorBody.classList.add("hidden");
  promptLock.classList.remove("hidden");
  customPrompt.value = "";
}

unlockPromptButton.addEventListener("click", async () => {
  promptMessage.textContent = "";
  promptResult.textContent = "";
  promptResult.className = "prompt-result";
  const password = promptUnlockPassword.value;
  if (!password) {
    promptResult.textContent = i18n.t("Ingresa la contraseña del administrador.");
    promptResult.className = "prompt-result prompt-error";
    promptUnlockPassword.focus();
    return;
  }
  unlockPromptButton.disabled = true;
  try {
    const response = await fetch("/api/prompt/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ password }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    customPrompt.value = body.content || "";
    promptUnlockPassword.value = "";
    promptLock.classList.add("hidden");
    promptEditorBody.classList.remove("hidden");
    customPrompt.readOnly = false;
  } catch (error) {
    promptResult.textContent = i18n.t(error.message);
    promptResult.className = "prompt-result prompt-error";
  } finally {
    unlockPromptButton.disabled = false;
  }
});

function closePromptConfirmation() {
  if (pendingConfirmationAction === "whatsapp") resetWhatsAppButton.disabled = false;
  stopPromptHold();
  promptConfirmModal.classList.add("hidden");
  document.querySelector("#prompt-confirm-title").textContent = i18n.t("¿Confirmar cambio de prompt?");
  document.querySelector("#prompt-confirm-modal p").textContent = i18n.t("El cambio afectará las próximas respuestas del asistente.");
  pendingConfirmationAction = "prompt";
}

function stopPromptHold() {
  if (promptHoldTimer) clearInterval(promptHoldTimer);
  promptHoldTimer = null;
  confirmPromptChange.disabled = false;
  confirmPromptChange.style.setProperty("--hold-progress", "0%");
  confirmPromptChange.textContent = i18n.t("Confirmar 3 s");
}

function hidePromptEditor() {
  promptEditorBody.classList.add("hidden");
  promptLock.classList.remove("hidden");
  customPrompt.value = "";
  promptPassword.value = "";
  promptUnlockPassword.value = "";
  promptMessage.textContent = "";
  promptMessage.className = "";
}

async function savePromptChange() {
  promptMessage.textContent = i18n.t("Guardando prompt…");
  promptMessage.className = "";
  savePromptButton.disabled = true;
  try {
    const response = await fetch("/api/prompt", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ content: customPrompt.value, password: promptPassword.value }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    promptPassword.value = "";
    promptMessage.textContent = i18n.t(body.message);
    promptMessage.className = "success";
    promptResult.textContent = i18n.t("Cambios guardados correctamente.");
    promptResult.className = "prompt-result success";
    hidePromptEditor();
  } catch (error) {
    promptMessage.textContent = i18n.t(error.message);
    promptMessage.className = "error";
  } finally {
    savePromptButton.disabled = false;
  }
}

async function resetWhatsAppSession() {
  showMessage("Desvinculando WhatsApp y preparando un QR nuevo…");
  try {
    const response = await fetch("/api/whatsapp/reset", {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    showMessage(body.message);
    resetWhatsAppPassword.value = "";
    resetWhatsAppMessage.textContent = "";
    setTimeout(updateBotStatus, 500);
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    resetWhatsAppButton.disabled = false;
  }
}

savePromptButton.addEventListener("click", async () => {
  if (!promptPassword.value) {
    promptMessage.textContent = i18n.t("Ingresa la contraseña del administrador para guardar.");
    promptMessage.className = "prompt-error";
    return;
  }
  promptMessage.textContent = i18n.t("Verificando contraseña…");
  promptMessage.className = "";
  try {
    const response = await fetch("/api/prompt/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ password: promptPassword.value }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
  } catch (error) {
    promptMessage.textContent = i18n.t(error.message);
    promptMessage.className = "prompt-error";
    return;
  }
  promptConfirmModal.classList.remove("hidden");
});

cancelPromptChange.addEventListener("click", closePromptConfirmation);
confirmPromptChange.addEventListener("pointerdown", () => {
  if (promptHoldTimer) return;
  const started = Date.now();
  promptHoldTimer = setInterval(() => {
    const elapsed = Date.now() - started;
    const progress = Math.min(100, (elapsed / 3000) * 100);
    confirmPromptChange.style.setProperty("--hold-progress", `${progress}%`);
    confirmPromptChange.textContent = `${i18n.t("Confirmando…")} ${Math.max(0, (3 - elapsed / 1000)).toFixed(1)} s`;
    if (elapsed >= 3000) {
      clearInterval(promptHoldTimer);
      promptHoldTimer = null;
      promptConfirmModal.classList.add("hidden");
      confirmPromptChange.disabled = false;
      confirmPromptChange.style.setProperty("--hold-progress", "0%");
      confirmPromptChange.textContent = i18n.t("Confirmar 3 s");
      if (pendingConfirmationAction === "whatsapp") {
        pendingConfirmationAction = "prompt";
        void resetWhatsAppSession();
      } else {
        void savePromptChange();
      }
    }
  }, 50);
});
for (const eventName of ["pointerup", "pointercancel", "pointerleave"]) {
  confirmPromptChange.addEventListener(eventName, () => {
    if (promptHoldTimer) stopPromptHold();
  });
}

hidePromptButton.addEventListener("click", hidePromptEditor);

promptUnlockPassword.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  unlockPromptButton.click();
});

promptPassword.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  savePromptButton.click();
});

document.querySelector("#refresh-tools").addEventListener("click", loadTools);
createBackupButton.addEventListener("click", async () => {
  const passphrase = document.querySelector("#backup-passphrase").value;
  toolsMessage.textContent = i18n.t("Creando respaldo…");
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
    toolsMessage.textContent = i18n.t(body.message);
    toolsMessage.className = "success";
    await loadTools();
  } catch (error) {
    toolsMessage.textContent = i18n.t(error.message);
    toolsMessage.className = "error";
  }
});

loadTools();


restoreBackupButton.addEventListener("click", async () => {
  const name = backupSelect.value;
  const passphrase = document.querySelector("#backup-passphrase").value;
  if (!name) {
    toolsMessage.textContent = i18n.t("Selecciona un respaldo.");
    toolsMessage.className = "error";
    return;
  }
  if (!confirm(i18n.t("La configuración, sesión, Vault y datos actuales serán reemplazados. Se creará un respaldo previo. ¿Continuar?"))) return;
  toolsMessage.textContent = i18n.t("Verificando y restaurando…");
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
    toolsMessage.textContent = i18n.t(body.message);
    toolsMessage.className = "success";
    await Promise.all([load(), loadFaqs(), loadTools()]);
  } catch (error) {
    toolsMessage.textContent = i18n.t(error.message);
    toolsMessage.className = "error";
  }
});

languageSelect.addEventListener("change", () => {
  i18n.setLanguage(languageSelect.value);
  updateWelcomeUser();
  renderFaqs();
  if (chats.length) renderChatList();
  updateModelControl(modelSelect.value, manualModel.value);
  updateBotStatus();
  updateHealth();
  loadTools();
  renderAvailability();
});
