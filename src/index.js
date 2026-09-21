import {
  APP_VERSION,
  AUTH_SESSION_PATH,
  FAQS_PATH,
  HUMAN_ALERTS_PATH,
  INSTANCE_LOCK_PATH,
  METRICS_PATH,
  VAULT_PATH,
  loadBotRuntimeConfig,
} from "./config.js";
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import pino from "pino";
import { loadFaqDocuments, buildFaqContext } from "./faqReader.js";
import {
  buildCustomerGreeting,
  createOutgoingMessageTracker,
  createRateLimiter,
  createMessageDeduplicator,
  extractMessageText,
  getAudioMessageInfo,
  getMessageTimestampMs,
  isMessageFromCurrentStartup,
  messageMatchesJid,
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
import { createMessageSender } from "./reliability.js";
import { secureDirectoryTree } from "./filesystemSecurity.js";
import { createContactProcessingQueue } from "./processingQueue.js";
import { formatContactForLog, logDuration } from "./operationalLog.js";
import { writeBotStatus } from "./botStatus.js";
import { createMetricsStore } from "./metricsStore.js";
import { createRuntimeController } from "./runtimeController.js";
import { createMessageBatcher } from "./messageBatcher.js";
import {
  sanitizeName,
  getConversationPath,
  loadConversation,
  saveConversation,
} from "./conversationStore.js";

const signalDiagnostics = installSignalLogFilter();
const whatsappLogger = pino({ level: "silent" });
const BOT_STARTED_AT_MS = Date.now();

function writeRuntimeStatus(state, details = {}, options) {
  writeBotStatus(state, { configurationOnly: CONFIGURATION_ONLY, ...details }, options);
}

const {
  configurationOnly: CONFIGURATION_ONLY,
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
} = loadBotRuntimeConfig();

const HUMAN_HANDOFF_MESSAGE =
  `Gracias por tu consulta. No cuento con la información necesaria para responderte correctamente en este momento. Derivaré tu mensaje a uno de los encargados de ${BUSINESS_NAME} para que pueda ayudarte. Te responderemos a la brevedad.`;
const SHORT_AUDIO_MESSAGE =
  "Por el momento no podemos escuchar mensajes de audio. Por favor, escríbenos tu consulta para poder ayudarte.";
const LONG_AUDIO_HANDOFF_MESSAGE =
  "He enviado tu mensaje de audio a un encargado para que pueda revisarlo y brindarte asistencia personalizada.";
const AUDIO_FORWARD_FAILURE_MESSAGE =
  "Por el momento no pudimos reenviar tu mensaje de audio. Por favor, escríbenos tu consulta para que podamos ayudarte.";

const isDuplicateMessage = createMessageDeduplicator();
const outgoingMessageTracker = createOutgoingMessageTracker();
const allowContactRequest = createRateLimiter({
  limit: MAX_REQUESTS_PER_HOUR,
  windowMs: 60 * 60 * 1000,
});
let activeSocket = null;
let startInProgress = false;
let whatsappLoggedOut = false;
const manualTakeovers = new Set();
const sessionRepairAttempts = new Map();
const MAX_SESSION_REPAIR_ATTEMPTS = 2;
const metrics = createMetricsStore(METRICS_PATH);

function recordMetric(name, amount = 1) {
  try {
    metrics.increment(name, amount);
  } catch (error) {
    console.error("⚠️ No se pudo actualizar una métrica local:", error.message);
  }
}

function recordDuration(name, durationMs) {
  try {
    metrics.duration(name, durationMs);
  } catch (error) {
    console.error("⚠️ No se pudo actualizar una duración local:", error.message);
  }
}

const runtime = createRuntimeController({
  connect: () => startBot(),
  getLoggedOut: () => whatsappLoggedOut,
  writeStatus: writeRuntimeStatus,
  onReconnectScheduled: (delayMs) => {
    recordMetric("whatsapp_reconnections");
    console.log(`🔄 Nuevo intento de conexión en ${delayMs / 1000} segundo(s)...`);
  },
  onReconnectFailure: (error) => {
    console.error("❌ No se pudo reiniciar la conexión con WhatsApp:", error.message);
  },
});
runtime.installProcessHandlers();

const enqueueContactProcessing = createContactProcessingQueue({
  onError: (remoteJid, error, phase) => {
    const label = phase === "previous" ? "anterior" : "inesperado";
    console.error(`❌ Error ${label} en la cola de ${formatContactForLog(remoteJid)}:`, error);
  },
});

const messageBatcher = createMessageBatcher({
  maxBatchMessages: MAX_BATCH_MESSAGES,
  maxInputChars: MAX_INPUT_CHARS,
  responseDelayMs: RESPONSE_DELAY_MS,
  audioForwardMinSeconds: AUDIO_FORWARD_MIN_SECONDS,
  allowRequest: allowContactRequest,
  onRateLimited: () => recordMetric("rate_limits_triggered"),
  shortAudioReply: SHORT_AUDIO_MESSAGE,
  longAudioReply: LONG_AUDIO_HANDOFF_MESSAGE,
  onFlush: (payload) => {
    enqueueContactProcessing(payload.remoteJid, () => processIncomingMessage(payload));
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
      recordMetric("audios_forwarded");
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
      console.error("❌ No se pudo cargar la información autorizada del negocio:", error.message);
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
        handoffReason: "No fue posible consultar la información autorizada del negocio.",
      };
    } else {
      const llmStartedAt = Date.now();
      try {
        const modelTurn = { ...userTurn, content: modelText };
        llmResult = await askLLM([...recentHistory, modelTurn].slice(-MAX_HISTORY_MESSAGES), context);
        recordMetric("llm_requests_succeeded");
      } catch (error) {
        recordMetric("llm_requests_failed");
        console.error("❌ No se pudo obtener una respuesta de OpenAI:", error.message);
        llmResult = {
          reply: "",
          needsHuman: true,
          handoffReason: "El asistente no pudo generar una respuesta por un problema técnico.",
        };
      } finally {
        const durationMs = logDuration("openai_request", llmStartedAt, `contact=${formatContactForLog(remoteJid)}`);
        recordDuration("llm_request", durationMs);
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
    if (awaitingHuman) recordMetric("human_handoffs");
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
    recordMetric("replies_sent");

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
  if (startInProgress || runtime.isStopping()) return;
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
    runtime.markConnected();
    recordMetric("whatsapp_connections");
    console.log("✅ Asistente de WhatsApp conectado.");
    writeRuntimeStatus("connected");
    if (CONFIGURATION_ONLY) {
      deferredMessageEvents.length = 0;
      return;
    }
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
        runtime.scheduleReconnect();
      });
    }, 250);
  }

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("Escanea este código QR con WhatsApp (Dispositivos vinculados):");
      qrcode.generate(qr, { small: true }, (qrDisplay) => {
        console.log(qrDisplay);
        writeRuntimeStatus("qr", { qrDisplay });
      });
    }

    if (connection === "close") {
      writeRuntimeStatus("reconnecting");
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
        runtime.scheduleReconnect();
      } else {
        whatsappLoggedOut = statusCode === DisconnectReason.loggedOut;
        console.error("❌ Sesión cerrada permanentemente. El bot se detendrá sin borrar auth_session automáticamente.");
        console.error("Para generar un QR nuevo, abre el panel local y usa la opción de desvinculación manual.");
        runtime.fatal("WhatsApp loggedOut", lastDisconnect?.error || new Error("Sesión cerrada"));
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
    recordMetric("message_upsert_events");
    recordMetric("messages_seen_by_baileys", messages.length);
    if (type !== "notify") {
      recordMetric("messages_ignored_non_notify", messages.length);
      return;
    }
    recordMetric("messages_notify", messages.length);

    for (const msg of messages) {
      if (shouldIgnoreRemoteJid(msg.key.remoteJid)) {
        recordMetric("messages_ignored_system_chat");
        continue;
      }

      const audioInfo = getAudioMessageInfo(msg.message);
      const text = audioInfo
        ? audioInfo.durationSeconds === null
          ? "[El cliente envió un mensaje de audio de duración desconocida.]"
          : `[El cliente envió un mensaje de audio de ${audioInfo.durationSeconds} segundos.]`
        : extractMessageText(msg.message);

      if (!text) {
        recordMetric("messages_ignored_without_content");
        continue;
      }

      const remoteJid = msg.key.remoteJid;

      if (msg.key.fromMe) {
        recordMetric("messages_from_business_account");
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

        const hasPendingMessages = messageBatcher.has(remoteJid);
        const convPath = getConversationPath(VAULT_PATH, CONVERSATIONS_FOLDER, remoteJid);
        const existing = loadConversation(convPath, CONVERSATION_EXPIRY_HOURS);
        if (
          !shouldRecordManualMessage({
            hasPendingMessages,
            hasActiveProcessing: enqueueContactProcessing.has(remoteJid),
            conversation: existing,
            messageTimestampMs: getMessageTimestampMs(msg),
            botStartedAtMs: BOT_STARTED_AT_MS,
          })
        ) {
          continue;
        }

        manualTakeovers.add(remoteJid);
        const pendingText = messageBatcher.cancel(remoteJid);
        enqueueContactProcessing(remoteJid, () =>
          recordHumanOutgoingMessage({ remoteJid, text, pendingText })
        );
        continue;
      }

      if (messageMatchesJid(msg.key, IGNORE_NUMBERS)) {
        recordMetric("messages_ignored_configured_number");
        continue;
      }
      if (isDuplicateMessage(msg.key.id)) {
        recordMetric("messages_ignored_duplicate");
        continue;
      }

      console.log(`📩 Mensaje recibido de ${formatContactForLog(remoteJid)}.`);
      recordMetric("messages_received");

      messageBatcher.add({
        remoteJid,
        text,
        audioInfo,
        message: msg,
        pushName: msg.pushName,
      });
    }
  };

  sock.ev.on("messages.upsert", (event) => {
    if (CONFIGURATION_ONLY) return;
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
  runtime.setReleaseLock(acquireInstanceLock(INSTANCE_LOCK_PATH));
  // Baileys puede dejar temporalmente su WebSocket sin handles referenciados.
  // Este temporizador mantiene vivo el servicio hasta una señal o un error fatal.
  runtime.startKeepAlive();
  writeRuntimeStatus("starting");
  const restoredAlerts = CONFIGURATION_ONLY ? 0 : humanAlertRetryQueue.restore();
  if (restoredAlerts > 0) {
    console.log(`📬 Se recuperaron ${restoredAlerts} aviso(s) pendiente(s); se enviarán al conectar.`);
  }
  console.log(`🚀 ${BUSINESS_NAME} — versión ${APP_VERSION}`);
  startBot().catch((error) => runtime.fatal("inicio", error));
} catch (error) {
  console.error(`❌ No se pudo iniciar el bot: ${error.message}`);
  process.exitCode = 1;
}
