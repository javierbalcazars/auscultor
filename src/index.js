import {
  APP_VERSION,
  AUTH_SESSION_PATH,
  FAQS_PATH,
  HUMAN_ALERTS_PATH,
  INSTANCE_LOCK_PATH,
  VAULT_PATH,
  loadRuntimeConfig,
} from "./config.js";
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import pino from "pino";
import { loadFaqDocuments, buildFaqContext } from "./faqReader.js";
import {
  buildCustomerGreeting,
  buildAudioBatchDecision,
  createOutgoingMessageTracker,
  createRateLimiter,
  createMessageDeduplicator,
  extractMessageText,
  getAudioMessageInfo,
  getMessageTimestampMs,
  isMessageFromCurrentStartup,
  messageMatchesJid,
  shouldForwardAudio,
  shouldRecordManualMessage,
  shouldIgnoreRemoteJid,
} from "./messageUtils.js";
import { prepareAudioForResend } from "./audioForwarder.js";
import { acquireInstanceLock } from "./instanceLock.js";
import { installSignalLogFilter } from "./signalLogFilter.js";
import { quarantineSignalSessions } from "./signalSessionRepair.js";
import { askLLM } from "./llm.js";
import { isHumanTakeoverActive } from "./handoff.js";
import { buildHumanAlert } from "./humanAlert.js";
import { createHumanAlertRetryQueue } from "./humanAlertRetry.js";
import { createHumanAlertStore } from "./humanAlertStore.js";
import { computeReconnectDelay, createMessageSender } from "./reliability.js";
import { secureDirectoryTree } from "./filesystemSecurity.js";
import { createContactProcessingQueue } from "./processingQueue.js";
import { formatContactForLog, logDuration } from "./operationalLog.js";
import { writeBotStatus } from "./botStatus.js";
import {
  sanitizeName,
  getConversationPath,
  loadConversation,
  saveConversation,
} from "./conversationStore.js";

const signalDiagnostics = installSignalLogFilter();
const whatsappLogger = pino({ level: "silent" });
const BOT_STARTED_AT_MS = Date.now();

const {
  businessName: BUSINESS_NAME,
  ignoreNumbers: IGNORE_NUMBERS,
  conversationsFolder: CONVERSATIONS_FOLDER,
  conversationExpiryHours: CONVERSATION_EXPIRY_HOURS,
  maxHistoryMessages: MAX_HISTORY_MESSAGES,
  maxStoredMessages: MAX_STORED_MESSAGES,
  maxInputChars: MAX_INPUT_CHARS,
  maxBatchMessages: MAX_BATCH_MESSAGES,
  maxRequestsPerHour: MAX_REQUESTS_PER_HOUR,
  responseDelayMs: RESPONSE_DELAY_MS,
  signalStartupValidationMs: SIGNAL_STARTUP_VALIDATION_MS,
  audioForwardMinSeconds: AUDIO_FORWARD_MIN_SECONDS,
  humanSupportJids: HUMAN_SUPPORT_JIDS,
  humanAlertCooldownMs: HUMAN_ALERT_COOLDOWN_MS,
  humanTakeoverMs: HUMAN_TAKEOVER_MS,
} = loadRuntimeConfig();

const HUMAN_HANDOFF_MESSAGE =
  `Gracias por tu consulta. No cuento con la información necesaria para responderte correctamente en este momento. Derivaré tu mensaje a uno de los encargados de ${BUSINESS_NAME} para que pueda ayudarte. Te responderemos a la brevedad.`;
const SHORT_AUDIO_MESSAGE =
  "Por el momento no podemos escuchar mensajes de audio. Por favor, escríbenos tu consulta para poder ayudarte.";
const LONG_AUDIO_HANDOFF_MESSAGE =
  "He enviado tu mensaje de audio a un encargado para que pueda revisarlo y brindarte asistencia personalizada.";
const AUDIO_FORWARD_FAILURE_MESSAGE =
  "Por el momento no pudimos reenviar tu mensaje de audio. Por favor, escríbenos tu consulta para que podamos ayudarte.";

const pendingMessages = new Map();
const isDuplicateMessage = createMessageDeduplicator();
const outgoingMessageTracker = createOutgoingMessageTracker();
const allowContactRequest = createRateLimiter({
  limit: MAX_REQUESTS_PER_HOUR,
  windowMs: 60 * 60 * 1000,
});
let fatalShutdownStarted = false;
let activeSocket = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let startInProgress = false;
let releaseProcessLock = null;
let keepAliveTimer = null;
let whatsappLoggedOut = false;
const manualTakeovers = new Set();
const sessionRepairAttempts = new Map();
const MAX_SESSION_REPAIR_ATTEMPTS = 2;

const enqueueContactProcessing = createContactProcessingQueue({
  onError: (remoteJid, error, phase) => {
    const label = phase === "previous" ? "anterior" : "inesperado";
    console.error(`❌ Error ${label} en la cola de ${formatContactForLog(remoteJid)}:`, error);
  },
});

const sendMessageWithRetry = createMessageSender({
  getSocket: () => activeSocket,
  outgoingTracker: outgoingMessageTracker,
  onAttemptFailure: ({ remoteJid, attempt, maxAttempts, error }) => {
    console.error(
      `⚠️ Falló el envío a ${formatContactForLog(remoteJid)} (intento ${attempt}/${maxAttempts}):`,
      error.message
    );
  },
});

function persistDeliveredHumanAlert({ remoteJid, deliveredAt }) {
  const convPath = getConversationPath(VAULT_PATH, CONVERSATIONS_FOLDER, remoteJid);
  const existing = loadConversation(convPath, CONVERSATION_EXPIRY_HOURS);
  if (!existing?.managedByBot) return;

  saveConversation(convPath, {
    jid: remoteJid,
    contactName: existing.contactName,
    history: existing.history,
    lastMessageAt: existing.lastMessageAt,
    humanNotifiedAt: deliveredAt,
    awaitingHuman: existing.awaitingHuman,
    humanHandoffAt: existing.humanHandoffAt,
  });
}

const humanAlertRetryQueue = createHumanAlertRetryQueue({
  store: createHumanAlertStore(HUMAN_ALERTS_PATH),
  deliver: async (payload, persistProgress) => {
    const alert = buildHumanAlert(payload);
    payload.deliveredSupportJids ||= [];
    for (const supportJid of HUMAN_SUPPORT_JIDS) {
      if (payload.deliveredSupportJids.includes(supportJid)) continue;
      await sendMessageWithRetry(supportJid, { text: alert });
      payload.deliveredSupportJids.push(supportJid);
      persistProgress();
    }
  },
  onDelivered: async (payload) => {
    const deliveredAt = new Date().toISOString();
    try {
      persistDeliveredHumanAlert({ remoteJid: payload.remoteJid, deliveredAt });
    } catch (error) {
      console.error("❌ La alerta fue entregada, pero no se pudo actualizar el registro:", error.message);
    }
    console.log(`👤 Encargado notificado por la consulta de ${formatContactForLog(payload.remoteJid)}.`);
  },
  onFailure: (payload, error) => {
    console.error(
      `❌ No se pudo avisar al encargado por ${formatContactForLog(payload.remoteJid)}; se reintentará automáticamente:`,
      error.message
    );
  },
});

function scheduleReconnect() {
  if (reconnectTimer || fatalShutdownStarted) return;

  const delayMs = computeReconnectDelay(reconnectAttempts);
  reconnectAttempts += 1;
  console.log(`🔄 Nuevo intento de conexión en ${delayMs / 1000} segundo(s)...`);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startBot().catch((error) => {
      console.error("❌ No se pudo reiniciar la conexión con WhatsApp:", error.message);
      scheduleReconnect();
    });
  }, delayMs);
}

function shutdownAfterFatalError(type, error) {
  if (fatalShutdownStarted) return;
  fatalShutdownStarted = true;
  console.error(`❌ Error fatal no controlado (${type}):`, error);
  console.error("El bot se cerrará para evitar continuar en un estado inconsistente.");
  process.exitCode = 1;
  setTimeout(() => process.exit(1), 100).unref();
}

process.on("unhandledRejection", (reason) => shutdownAfterFatalError("unhandledRejection", reason));
process.on("uncaughtException", (error) => shutdownAfterFatalError("uncaughtException", error));
process.once("exit", () => {
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  releaseProcessLock?.();
  writeBotStatus("stopped", { whatsappLoggedOut }, { onlyIfCurrentProcess: true });
});
process.once("SIGINT", () => {
  releaseProcessLock?.();
  writeBotStatus("stopped", {}, { onlyIfCurrentProcess: true });
  process.exit(0);
});
process.once("SIGTERM", () => {
  releaseProcessLock?.();
  writeBotStatus("stopped", {}, { onlyIfCurrentProcess: true });
  process.exit(0);
});
process.once("SIGHUP", () => {
  releaseProcessLock?.();
  process.exit(0);
});

function humanAlertIsOnCooldown(lastNotification) {
  if (!lastNotification) return false;
  const elapsed = Date.now() - new Date(lastNotification).getTime();
  return Number.isFinite(elapsed) && elapsed >= 0 && elapsed < HUMAN_ALERT_COOLDOWN_MS;
}

async function notifyHuman({
  remoteJid,
  contactName,
  text,
  reason,
  messagesToForward = [],
}) {
  let alertSent = false;
  let forwardedCount = 0;
  const alertPayload = {
    remoteJid,
    contactName: contactName || null,
    text: String(text || "").slice(0, 1500),
    reason: String(reason || "La consulta requiere atención humana.").slice(0, 300),
    createdAt: new Date().toISOString(),
    deliveredSupportJids: [],
  };
  const alertDelivery = await humanAlertRetryQueue.sendOrQueue(alertPayload);
  alertSent = alertDelivery.sent;

  for (const message of messagesToForward) {
    try {
      const audioContent = await prepareAudioForResend({
        message,
        socket: activeSocket,
        logger: whatsappLogger,
      });
      for (const supportJid of HUMAN_SUPPORT_JIDS) {
        await sendMessageWithRetry(supportJid, audioContent);
      }
      forwardedCount += 1;
      console.log(`🎧 Audio de ${formatContactForLog(remoteJid)} reenviado al encargado.`);
    } catch (error) {
      console.error("❌ No se pudo reenviar el audio al encargado:", error.message);
    }
  }

  return {
    alertSent,
    alertQueued: !alertSent && humanAlertRetryQueue.has(remoteJid),
    allForwardsSent: forwardedCount === messagesToForward.length,
  };
}

async function processIncomingMessage({
  remoteJid,
  text,
  modelText = text,
  pushName,
  forcedHandoffReason = null,
  presetResult = null,
  forcedReply = null,
  replyPrefix = "",
  supportMessagesToForward = [],
}) {
  try {
    const convPath = getConversationPath(VAULT_PATH, CONVERSATIONS_FOLDER, remoteJid);
    const loadedConversation = loadConversation(convPath, CONVERSATION_EXPIRY_HOURS);
    const existing = loadedConversation?.managedByBot ? loadedConversation : null;
    const activeConversation = existing && !existing.isExpired ? existing : null;

    const history = existing ? [...existing.history] : [];
    const recentHistory = activeConversation
      ? history.slice(-MAX_HISTORY_MESSAGES)
      : [];
    const isFirstMessage = recentHistory.length === 0;

    // Si ya teníamos un nombre válido guardado de esta conversación (no vencida),
    // lo mantenemos. Si no, probamos sanitizar el pushName actual de WhatsApp.
    const contactName = existing?.contactName || sanitizeName(pushName);
    let humanNotifiedAt = activeConversation?.humanNotifiedAt || null;
    let forwardedNotificationHandled = false;
    let audioForwardFailed = false;

    // Los audios largos siempre deben llegar al WhatsApp personal del encargado,
    // incluso si el chat ya se encontraba pausado por una derivación anterior.
    if (supportMessagesToForward.length > 0) {
      saveConversation(convPath, {
        jid: remoteJid,
        contactName,
        history: [...history, { role: "user", content: text, time: new Date().toISOString() }].slice(-MAX_STORED_MESSAGES),
        humanNotifiedAt,
        awaitingHuman: true,
        humanHandoffAt: activeConversation?.humanHandoffAt || new Date().toISOString(),
      });
      const notification = await notifyHuman({
        remoteJid,
        contactName,
        text,
        reason: presetResult?.handoffReason || forcedHandoffReason,
        messagesToForward: supportMessagesToForward,
      });
      forwardedNotificationHandled = notification.alertSent || notification.alertQueued;
      audioForwardFailed = !notification.allForwardsSent;
      if (notification.alertSent) humanNotifiedAt = new Date().toISOString();
    }

    if (isHumanTakeoverActive(activeConversation, HUMAN_TAKEOVER_MS)) {
      if (!humanNotifiedAt && !humanAlertRetryQueue.has(remoteJid)) {
        const notification = await notifyHuman({
          remoteJid,
          contactName,
          text,
          reason: "La conversación continúa reservada para atención humana.",
        });
        if (notification.alertSent) humanNotifiedAt = new Date().toISOString();
      }
      history.push({ role: "user", content: text, time: new Date().toISOString() });
      saveConversation(convPath, {
        jid: remoteJid,
        contactName,
        history: history.slice(-MAX_STORED_MESSAGES),
        humanNotifiedAt,
        awaitingHuman: true,
        humanHandoffAt: activeConversation.humanHandoffAt,
      });
      console.log(`👤 Mensaje de ${formatContactForLog(remoteJid)} reservado para atención humana.`);
      return;
    }

    const userTurn = { role: "user", content: text, time: new Date().toISOString() };
    history.push(userTurn);
    const storedHistory = history.slice(-MAX_STORED_MESSAGES);
    saveConversation(convPath, {
      jid: remoteJid,
      contactName,
      history: storedHistory,
      humanNotifiedAt,
      awaitingHuman: false,
      humanHandoffAt: null,
    });

    let context = "";
    let contextLoadError = null;
    try {
      const notes = loadFaqDocuments(FAQS_PATH);
      context = buildFaqContext(notes);
      if (!context.trim()) {
        throw new Error("La carpeta de preguntas frecuentes no contiene información");
      }
    } catch (error) {
      contextLoadError = error;
      console.error("❌ No se pudo cargar la información autorizada del glamping:", error.message);
    }

    let llmResult;
    if (forcedHandoffReason) {
      llmResult = {
        reply: "",
        needsHuman: true,
        handoffReason: forcedHandoffReason,
      };
    } else if (presetResult) {
      llmResult = presetResult;
    } else if (contextLoadError) {
      llmResult = {
        reply: "",
        needsHuman: true,
        handoffReason: "No fue posible consultar la información autorizada del glamping.",
      };
    } else {
      const llmStartedAt = Date.now();
      try {
        const modelTurn = { ...userTurn, content: modelText };
        llmResult = await askLLM([...recentHistory, modelTurn].slice(-MAX_HISTORY_MESSAGES), context);
      } catch (error) {
        console.error("❌ No se pudo obtener una respuesta de OpenAI:", error.message);
        llmResult = {
          reply: "",
          needsHuman: true,
          handoffReason: "El asistente no pudo generar una respuesta por un problema técnico.",
        };
      } finally {
        logDuration("openai_request", llmStartedAt, `contact=${formatContactForLog(remoteJid)}`);
      }
    }

    const baseReply = audioForwardFailed
      ? AUDIO_FORWARD_FAILURE_MESSAGE
      : forcedReply || (llmResult.needsHuman ? HUMAN_HANDOFF_MESSAGE : llmResult.reply);
    const greeting = isFirstMessage ? buildCustomerGreeting(contactName) : "";
    const reply = [greeting, replyPrefix, baseReply]
      .filter((part) => part?.trim())
      .join("\n\n");
    const awaitingHuman = llmResult.needsHuman;
    const humanHandoffAt = awaitingHuman ? new Date().toISOString() : null;

    const cancelAutomaticReplyIfManual = () => {
      if (!manualTakeovers.has(remoteJid)) return false;
      saveConversation(convPath, {
        jid: remoteJid,
        contactName,
        history: storedHistory,
        humanNotifiedAt,
        awaitingHuman: true,
        humanHandoffAt: activeConversation?.humanHandoffAt || new Date().toISOString(),
      });
      console.log(
        `👤 Respuesta automática cancelada: un encargado tomó el chat ${formatContactForLog(remoteJid)}.`
      );
      return true;
    };

    if (cancelAutomaticReplyIfManual()) return;

    // La pausa debe sobrevivir incluso si el proceso se detiene durante el aviso.
    saveConversation(convPath, {
      jid: remoteJid,
      contactName,
      history: storedHistory,
      humanNotifiedAt,
      awaitingHuman,
      humanHandoffAt,
    });

    if (
      llmResult.needsHuman &&
      !forwardedNotificationHandled &&
      !humanAlertIsOnCooldown(humanNotifiedAt)
    ) {
      const notification = await notifyHuman({
        remoteJid,
        contactName,
        text,
        reason: llmResult.handoffReason,
      });
      if (notification.alertSent) {
        humanNotifiedAt = new Date().toISOString();
      }
    }

    // La entrega de una alerta también puede tardar varios segundos. Volvemos
    // a comprobar la toma manual justo antes de enviar la respuesta automática.
    if (cancelAutomaticReplyIfManual()) return;

    // Guardamos primero el estado de derivación y el mensaje recibido. La
    // respuesta del asistente solo se añade después de que WhatsApp confirme
    // que pudo enviarla.
    saveConversation(convPath, {
      jid: remoteJid,
      contactName,
      history: storedHistory,
      humanNotifiedAt,
      awaitingHuman,
      humanHandoffAt,
    });

    await sendMessageWithRetry(remoteJid, { text: reply });

    history.push({
      role: "assistant",
      content: reply,
      source: "bot",
      time: new Date().toISOString(),
    });
    saveConversation(convPath, {
      jid: remoteJid,
      contactName,
      history: history.slice(-MAX_STORED_MESSAGES),
      humanNotifiedAt,
      awaitingHuman,
      humanHandoffAt,
    });

    console.log(`✅ Respondido a ${formatContactForLog(remoteJid)}.`);
  } catch (err) {
    console.error("❌ Error procesando mensaje:", err.message);
  }
}

async function recordHumanOutgoingMessage({ remoteJid, text, pendingText = "" }) {
  let saved = false;
  try {
    const convPath = getConversationPath(VAULT_PATH, CONVERSATIONS_FOLDER, remoteJid);
    const loadedConversation = loadConversation(convPath, CONVERSATION_EXPIRY_HOURS);
    const existing = loadedConversation?.managedByBot ? loadedConversation : null;
    const history = existing ? [...existing.history] : [];
    const now = new Date().toISOString();

    if (pendingText) {
      history.push({ role: "user", content: pendingText, time: now });
    }

    history.push({ role: "assistant", content: text, source: "human", time: now });
    saveConversation(convPath, {
      jid: remoteJid,
      contactName: existing?.contactName || null,
      history: history.slice(-MAX_STORED_MESSAGES),
      humanNotifiedAt: existing?.humanNotifiedAt || null,
      awaitingHuman: true,
      humanHandoffAt: existing?.humanHandoffAt || now,
    });
    saved = true;
  } catch (error) {
    console.error("❌ No se pudo registrar la respuesta manual:", error.message);
  } finally {
    // Si no se pudo guardar el estado, se conserva la pausa en memoria para
    // evitar que la IA se cruce con la atención humana.
    if (saved) manualTakeovers.delete(remoteJid);
  }
}

async function startBot() {
  if (startInProgress || fatalShutdownStarted) return;
  startInProgress = true;

  let sock;
  let saveCreds;
  let socketReady = false;
  let startupValidationStarted = false;
  let startupValidationTimer = null;
  let restartingAfterSessionRepair = false;
  let handleMessagesUpsert;
  const deferredMessageEvents = [];
  try {
    signalDiagnostics.resetForRetry();
    const auth = await useMultiFileAuthState(AUTH_SESSION_PATH);
    saveCreds = auth.saveCreds;
    secureDirectoryTree(AUTH_SESSION_PATH);

    sock = makeWASocket({
      auth: auth.state,
      printQRInTerminal: false,
      logger: whatsappLogger,
    });
  } finally {
    startInProgress = false;
  }

  sock.ev.on("creds.update", async () => {
    try {
      await saveCreds();
      secureDirectoryTree(AUTH_SESSION_PATH);
    } catch (error) {
      console.error("❌ No se pudieron guardar las credenciales de WhatsApp:", error.message);
    }
  });

  async function activateSocket() {
    signalDiagnostics.markConnected();
    activeSocket = sock;
    socketReady = true;
    reconnectAttempts = 0;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    console.log("✅ Asistente de WhatsApp conectado.");
    writeBotStatus("connected");
    await humanAlertRetryQueue.flush();

    for (const event of deferredMessageEvents.splice(0)) {
      try {
        await handleMessagesUpsert(event);
      } catch (error) {
        console.error("❌ No se pudo procesar un mensaje recibido durante el inicio:", error.message);
      }
    }
  }

  function restartAfterSessionRepair() {
    restartingAfterSessionRepair = true;
    socketReady = false;
    deferredMessageEvents.length = 0;
    signalDiagnostics.resetForRetry();
    sock.end(new Error("Reinicio controlado después de reparar una sesión cifrada"));
    setTimeout(() => {
      startBot().catch((error) => {
        console.error("❌ No se pudo reiniciar después de reparar la sesión:", error.message);
        scheduleReconnect();
      });
    }, 250);
  }

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("Escanea este código QR con WhatsApp (Dispositivos vinculados):");
      qrcode.generate(qr, { small: true }, (qrDisplay) => {
        console.log(qrDisplay);
        writeBotStatus("qr", { qrDisplay });
      });
    }

    if (connection === "close") {
      writeBotStatus("reconnecting");
      if (startupValidationTimer) {
        clearTimeout(startupValidationTimer);
        startupValidationTimer = null;
      }
      if (restartingAfterSessionRepair) {
        if (activeSocket === sock) activeSocket = null;
        return;
      }
      signalDiagnostics.markConnectionFailed();
      if (activeSocket && activeSocket !== sock) return;
      if (activeSocket === sock) activeSocket = null;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = ![
        DisconnectReason.loggedOut,
        DisconnectReason.badSession,
        DisconnectReason.connectionReplaced,
      ].includes(statusCode);

      const reasonMessages = {
        [DisconnectReason.loggedOut]:
          "La sesión fue desvinculada desde el celular (WhatsApp > Dispositivos vinculados). Usa el panel local para generar un QR nuevo cuando quieras revincular.",
        [DisconnectReason.badSession]:
          "Sesión corrupta. Usa el panel local para revincular WhatsApp si el problema continúa.",
        [DisconnectReason.connectionClosed]: "La conexión se cerró inesperadamente.",
        [DisconnectReason.connectionLost]:
          "Se perdió la conexión a los servidores de WhatsApp (revisá tu wifi/internet).",
        [DisconnectReason.connectionReplaced]:
          "Se abrió otra sesión de WhatsApp Web con este mismo número en otro lugar.",
        [DisconnectReason.restartRequired]: "WhatsApp pidió reiniciar la conexión.",
        [DisconnectReason.timedOut]: "Se agotó el tiempo de espera (revisá tu conexión a internet).",
      };

      console.error(
        `⚠️  Conexión con WhatsApp cerrada [código ${statusCode ?? "desconocido"}]: ${
          reasonMessages[statusCode] || lastDisconnect?.error?.message || "motivo desconocido"
        }`
      );

      if (shouldReconnect) {
        scheduleReconnect();
      } else {
        whatsappLoggedOut = statusCode === DisconnectReason.loggedOut;
        console.error("❌ Sesión cerrada permanentemente. El bot se detendrá sin borrar auth_session automáticamente.");
        console.error("Para generar un QR nuevo, abre el panel local y usa la opción de desvinculación manual.");
        shutdownAfterFatalError("WhatsApp loggedOut", lastDisconnect?.error || new Error("Sesión cerrada"));
      }
    } else if (connection === "open") {
      if (startupValidationStarted) return;
      startupValidationStarted = true;
      startupValidationTimer = setTimeout(async () => {
        startupValidationTimer = null;
        try {
          const detectedAddresses = signalDiagnostics.takeRepairableSessionAddresses();
          const eligibleAddresses = detectedAddresses.filter(
            (address) => (sessionRepairAttempts.get(address) || 0) < MAX_SESSION_REPAIR_ATTEMPTS
          );
          const skippedAddresses = detectedAddresses.length - eligibleAddresses.length;
          const repair = quarantineSignalSessions(AUTH_SESSION_PATH, eligibleAddresses);

          if (repair.movedFiles.length > 0) {
            for (const address of repair.repairedAddresses) {
              sessionRepairAttempts.set(address, (sessionRepairAttempts.get(address) || 0) + 1);
            }
            secureDirectoryTree(AUTH_SESSION_PATH);
            console.log(
              `🛠️ Se repararon ${repair.movedFiles.length} archivo(s) de sesión cifrada antes de activar el asistente. Reconectando...`
            );
            restartAfterSessionRepair();
            return;
          }

          if (skippedAddresses > 0) {
            console.warn(
              "⚠️ Una sesión cifrada continuó fallando después de dos reparaciones automáticas; se mantendrá el diagnóstico visible."
            );
          }
          await activateSocket();
        } catch (error) {
          console.error("❌ Falló la reparación automática de sesiones cifradas:", error.message);
          await activateSocket();
        }
      }, SIGNAL_STARTUP_VALIDATION_MS);
    }
  });

  handleMessagesUpsert = async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (shouldIgnoreRemoteJid(msg.key.remoteJid)) continue;

      const audioInfo = getAudioMessageInfo(msg.message);
      const text = audioInfo
        ? audioInfo.durationSeconds === null
          ? "[El cliente envió un mensaje de audio de duración desconocida.]"
          : `[El cliente envió un mensaje de audio de ${audioInfo.durationSeconds} segundos.]`
        : extractMessageText(msg.message);

      if (!text) continue;

      const remoteJid = msg.key.remoteJid;

      if (msg.key.fromMe) {
        if (
          outgoingMessageTracker.consumeIfAutomated({
            remoteJid,
            messageId: msg.key.id,
            text,
          })
        ) {
          continue;
        }

        // El aviso enviado al número del encargado no representa una toma de
        // control de la conversación de un cliente.
        if (messageMatchesJid(msg.key, HUMAN_SUPPORT_JIDS)) {
          continue;
        }

        const pending = pendingMessages.get(remoteJid);
        const convPath = getConversationPath(VAULT_PATH, CONVERSATIONS_FOLDER, remoteJid);
        const existing = loadConversation(convPath, CONVERSATION_EXPIRY_HOURS);
        if (
          !shouldRecordManualMessage({
            hasPendingMessages: Boolean(pending),
            hasActiveProcessing: enqueueContactProcessing.has(remoteJid),
            conversation: existing,
            messageTimestampMs: getMessageTimestampMs(msg),
            botStartedAtMs: BOT_STARTED_AT_MS,
          })
        ) {
          continue;
        }

        manualTakeovers.add(remoteJid);
        if (pending?.timer) clearTimeout(pending.timer);
        pendingMessages.delete(remoteJid);
        const pendingText = pending?.texts?.join("\n").slice(0, MAX_INPUT_CHARS) || "";
        enqueueContactProcessing(remoteJid, () =>
          recordHumanOutgoingMessage({ remoteJid, text, pendingText })
        );
        continue;
      }

      if (messageMatchesJid(msg.key, IGNORE_NUMBERS)) continue;
      if (isDuplicateMessage(msg.key.id)) continue;

      console.log(`📩 Mensaje recibido de ${formatContactForLog(remoteJid)}.`);

      const pending = pendingMessages.get(remoteJid);
      if (pending) clearTimeout(pending.timer);

      const batch = pending || {
        texts: [],
        modelTexts: [],
        shortAudioCount: 0,
        longAudioMessages: [],
        totalChars: 0,
        pushName: msg.pushName,
        timer: null,
      };
      batch.texts.push(text);
      if (audioInfo) {
        if (shouldForwardAudio(audioInfo, AUDIO_FORWARD_MIN_SECONDS)) {
          batch.longAudioMessages.push(msg);
        } else {
          batch.shortAudioCount += 1;
        }
      } else {
        batch.modelTexts.push(text);
      }
      batch.totalChars += text.length + (batch.texts.length > 1 ? 1 : 0);
      if (!batch.pushName && msg.pushName) batch.pushName = msg.pushName;

      const flushBatch = () => {
        if (pendingMessages.get(remoteJid) !== batch) return;
        pendingMessages.delete(remoteJid);
        const exceededInputLimit = batch.totalChars > MAX_INPUT_CHARS;
        const combinedText = batch.texts.join("\n").slice(0, MAX_INPUT_CHARS);
        const combinedModelText = batch.modelTexts.join("\n").slice(0, MAX_INPUT_CHARS);
        const allowedByRateLimit = allowContactRequest(remoteJid);
        const forcedHandoffReason = exceededInputLimit
          ? "La consulta superó el tamaño máximo permitido y requiere revisión humana."
          : !allowedByRateLimit
            ? "El contacto superó el límite de consultas automáticas por hora."
            : null;
        const audioDecision = buildAudioBatchDecision({
          longAudioMessages: batch.longAudioMessages,
          shortAudioCount: batch.shortAudioCount,
          textMessageCount: batch.modelTexts.length,
          forcedHandoffReason,
        });
        const presetResult = audioDecision.hasLongAudio && audioDecision.canApplyAutomaticAudioReply
          ? {
              reply: "",
              needsHuman: true,
              handoffReason: `El cliente envió un audio de ${AUDIO_FORWARD_MIN_SECONDS} segundos o más.`,
            }
          : audioDecision.onlyShortAudios
            ? { reply: "", needsHuman: false, handoffReason: "" }
            : null;
        const forcedReply = audioDecision.hasLongAudio && audioDecision.canApplyAutomaticAudioReply
          ? LONG_AUDIO_HANDOFF_MESSAGE
          : audioDecision.onlyShortAudios
            ? SHORT_AUDIO_MESSAGE
            : null;
        const replyPrefix =
          audioDecision.canApplyAutomaticAudioReply &&
          batch.shortAudioCount > 0 &&
          batch.modelTexts.length > 0
            ? SHORT_AUDIO_MESSAGE
            : "";
        // Los audios largos siempre se reenvían. Los límites de texto o de
        // consultas solo cambian el motivo de derivación, no bloquean el audio.
        const supportMessagesToForward = audioDecision.supportMessagesToForward;

        enqueueContactProcessing(remoteJid, () =>
          processIncomingMessage({
            remoteJid,
            text: combinedText,
            modelText: combinedModelText || combinedText,
            pushName: batch.pushName,
            forcedHandoffReason,
            presetResult,
            forcedReply,
            replyPrefix,
            supportMessagesToForward,
          })
        );
      };

      if (batch.texts.length >= MAX_BATCH_MESSAGES || batch.totalChars >= MAX_INPUT_CHARS) {
        batch.timer = null;
        pendingMessages.set(remoteJid, batch);
        flushBatch();
        continue;
      }

      batch.timer = setTimeout(flushBatch, RESPONSE_DELAY_MS);

      pendingMessages.set(remoteJid, batch);
    }
  };

  sock.ev.on("messages.upsert", (event) => {
    if (!socketReady) {
      if (event.type === "notify") {
        const currentMessages = event.messages.filter((message) =>
          isMessageFromCurrentStartup(message, BOT_STARTED_AT_MS)
        );
        if (currentMessages.length > 0) {
          deferredMessageEvents.push({ ...event, messages: currentMessages });
        }
      }
      return;
    }
    handleMessagesUpsert(event).catch((error) => {
      console.error("❌ No se pudo procesar un mensaje entrante:", error.message);
    });
  });
}

try {
  releaseProcessLock = acquireInstanceLock(INSTANCE_LOCK_PATH);
  // Baileys puede dejar temporalmente su WebSocket sin handles referenciados.
  // Este temporizador mantiene vivo el servicio hasta una señal o un error fatal.
  keepAliveTimer = setInterval(() => {}, 60_000);
  writeBotStatus("starting");
  const restoredAlerts = humanAlertRetryQueue.restore();
  if (restoredAlerts > 0) {
    console.log(`📬 Se recuperaron ${restoredAlerts} aviso(s) pendiente(s); se enviarán al conectar.`);
  }
  console.log(`🚀 ${BUSINESS_NAME} — versión ${APP_VERSION}`);
  startBot().catch((error) => shutdownAfterFatalError("inicio", error));
} catch (error) {
  console.error(`❌ No se pudo iniciar el bot: ${error.message}`);
  process.exitCode = 1;
}
