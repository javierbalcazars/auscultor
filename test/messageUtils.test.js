import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCustomerGreeting,
  buildAudioBatchDecision,
  createMessageDeduplicator,
  createOutgoingMessageTracker,
  createRateLimiter,
  extractMessageText,
  getAudioMessageInfo,
  getMessageTimestampMs,
  isMessageFromCurrentStartup,
  messageMatchesJid,
  shouldForwardAudio,
  shouldRecordManualMessage,
  shouldIgnoreRemoteJid,
} from "../src/messageUtils.js";

test("extrae texto de formatos comunes y describe formatos sin texto", () => {
  assert.equal(extractMessageText({ conversation: "Hola" }), "Hola");
  assert.equal(extractMessageText({ imageMessage: { caption: "Ubicación" } }), "Ubicación");
  assert.equal(
    extractMessageText({ ephemeralMessage: { message: { extendedTextMessage: { text: "Reserva" } } } }),
    "Reserva"
  );
  assert.equal(extractMessageText({ audioMessage: {} }), "[El cliente envió un mensaje de audio.]");
  assert.equal(extractMessageText({ reactionMessage: { text: "👍" } }), "");
});

test("detecta la duración de audios, incluidos los envueltos", () => {
  assert.deepEqual(getAudioMessageInfo({ audioMessage: { seconds: 20 } }), {
    durationSeconds: 20,
  });
  assert.deepEqual(
    getAudioMessageInfo({
      ephemeralMessage: { message: { audioMessage: { seconds: "19" } } },
    }),
    { durationSeconds: 19 }
  );
  assert.deepEqual(getAudioMessageInfo({ audioMessage: {} }), { durationSeconds: null });
  assert.equal(getAudioMessageInfo({ conversation: "Hola" }), null);
});

test("reenvía solamente audios de diez segundos o más", () => {
  assert.equal(shouldForwardAudio({ durationSeconds: 9 }, 10), false);
  assert.equal(shouldForwardAudio({ durationSeconds: 10 }, 10), true);
  assert.equal(shouldForwardAudio({ durationSeconds: 11 }, 10), true);
  assert.equal(shouldForwardAudio({ durationSeconds: null }, 10), false);
});

test("mantiene los audios largos para el encargado aunque exista otro límite", () => {
  const audio = { key: { id: "audio-largo" } };
  const decision = buildAudioBatchDecision({
    longAudioMessages: [audio],
    forcedHandoffReason: "El contacto superó el límite por hora.",
  });

  assert.equal(decision.canApplyAutomaticAudioReply, false);
  assert.deepEqual(decision.supportMessagesToForward, [audio]);
});

test("normaliza la fecha de mensajes de WhatsApp", () => {
  assert.equal(getMessageTimestampMs({ messageTimestamp: 1_787_690_000 }), 1_787_690_000_000);
  assert.equal(getMessageTimestampMs({ messageTimestamp: 1_787_690_000_000 }), 1_787_690_000_000);
  assert.equal(getMessageTimestampMs({}), null);
});

test("durante el arranque acepta mensajes nuevos y descarta sincronizaciones históricas", () => {
  const startedAt = 1_787_690_000_000;
  assert.equal(
    isMessageFromCurrentStartup({ messageTimestamp: 1_787_689_995 }, startedAt),
    true
  );
  assert.equal(
    isMessageFromCurrentStartup({ messageTimestamp: 1_787_680_000 }, startedAt),
    false
  );
  assert.equal(isMessageFromCurrentStartup({}, startedAt), false);
});

test("registra solo respuestas manuales nuevas en chats derivados o pendientes", () => {
  const startedAt = 1_787_690_000_000;
  assert.equal(shouldRecordManualMessage(), false);
  assert.equal(
    shouldRecordManualMessage({
      conversation: { managedByBot: true, awaitingHuman: false },
      messageTimestampMs: startedAt,
      botStartedAtMs: startedAt,
    }),
    false
  );
  assert.equal(
    shouldRecordManualMessage({
      conversation: { managedByBot: true, awaitingHuman: true },
      messageTimestampMs: startedAt,
      botStartedAtMs: startedAt,
    }),
    true
  );
  assert.equal(
    shouldRecordManualMessage({
      hasActiveProcessing: true,
      messageTimestampMs: startedAt,
      botStartedAtMs: startedAt,
    }),
    true
  );
  assert.equal(
    shouldRecordManualMessage({
      hasPendingMessages: true,
      messageTimestampMs: startedAt - 60_000,
      botStartedAtMs: startedAt,
    }),
    false
  );
  assert.equal(
    shouldRecordManualMessage({
      hasPendingMessages: true,
      messageTimestampMs: startedAt,
      botStartedAtMs: startedAt,
    }),
    true
  );
});

test("genera el saludo fuera del prompt usando un nombre ya sanitizado", () => {
  assert.equal(
    buildCustomerGreeting("Bárbara Wagner"),
    "¡Hola, Bárbara Wagner! Gracias por escribirnos 😊"
  );
  assert.equal(buildCustomerGreeting(null), "¡Hola! Gracias por escribirnos 😊");
});

test("ignora grupos, estados, difusiones y canales", () => {
  assert.equal(shouldIgnoreRemoteJid("1@g.us"), true);
  assert.equal(shouldIgnoreRemoteJid("status@broadcast"), true);
  assert.equal(shouldIgnoreRemoteJid("1@newsletter"), true);
  assert.equal(shouldIgnoreRemoteJid("1@s.whatsapp.net"), false);
});

test("reconoce un número ignorado aunque el chat llegue identificado por LID", () => {
  assert.equal(
    messageMatchesJid(
      { remoteJid: "123456@lid", senderPn: "56911112222@s.whatsapp.net" },
      ["56911112222@s.whatsapp.net"]
    ),
    true
  );
  assert.equal(
    messageMatchesJid({ remoteJid: "123456@lid" }, ["56911112222@s.whatsapp.net"]),
    false
  );
});

test("bloquea mensajes duplicados dentro de su ventana", () => {
  const duplicate = createMessageDeduplicator({ ttlMs: 1000, maxEntries: 10 });
  assert.equal(duplicate("id", 0), false);
  assert.equal(duplicate("id", 500), true);
  assert.equal(duplicate("id", 1500), false);
});

test("limita solicitudes por contacto", () => {
  const allow = createRateLimiter({ limit: 2, windowMs: 1000 });
  assert.equal(allow("cliente", 0), true);
  assert.equal(allow("cliente", 100), true);
  assert.equal(allow("cliente", 200), false);
  assert.equal(allow("cliente", 1200), true);
});

test("diferencia mensajes automáticos y manuales", () => {
  const tracker = createOutgoingMessageTracker();
  const token = tracker.prepare("cliente", { text: "Respuesta automática" });
  tracker.markSent(token, "auto-id", 0);
  assert.equal(
    tracker.consumeIfAutomated(
      { remoteJid: "cliente", messageId: "auto-id", text: "Respuesta automática" },
      500
    ),
    true
  );
  assert.equal(
    tracker.consumeIfAutomated({ remoteJid: "cliente", messageId: "manual-id", text: "Respuesta humana" }, 500),
    false
  );
});
