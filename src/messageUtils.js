const WRAPPER_KEYS = [
  "ephemeralMessage",
  "viewOnceMessage",
  "viewOnceMessageV2",
  "viewOnceMessageV2Extension",
  "documentWithCaptionMessage",
];

export function unwrapMessage(message) {
  let current = message;

  for (let depth = 0; depth < 5 && current; depth += 1) {
    const wrapperKey = WRAPPER_KEYS.find((key) => current[key]?.message);
    if (!wrapperKey) break;
    current = current[wrapperKey].message;
  }

  return current || {};
}

export function extractMessageText(message) {
  const content = unwrapMessage(message);

  const text =
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    content.buttonsResponseMessage?.selectedDisplayText ||
    content.buttonsResponseMessage?.selectedButtonId ||
    content.listResponseMessage?.title ||
    content.listResponseMessage?.singleSelectReply?.selectedRowId ||
    content.templateButtonReplyMessage?.selectedDisplayText ||
    content.templateButtonReplyMessage?.selectedId ||
    "";

  if (typeof text === "string" && text.trim()) return text.trim();

  if (content.audioMessage) return "[El cliente envió un mensaje de audio.]";
  if (content.imageMessage) return "[El cliente envió una imagen sin texto.]";
  if (content.videoMessage) return "[El cliente envió un video sin texto.]";
  if (content.documentMessage) return "[El cliente envió un documento sin texto.]";
  if (content.locationMessage || content.liveLocationMessage) {
    return "[El cliente compartió una ubicación.]";
  }
  if (content.contactMessage || content.contactsArrayMessage) {
    return "[El cliente compartió un contacto.]";
  }
  if (content.stickerMessage) return "[El cliente envió un sticker.]";

  // Reacciones, recibos y mensajes de protocolo no requieren una respuesta.
  return "";
}

export function getAudioMessageInfo(message) {
  const audioMessage = unwrapMessage(message).audioMessage;
  if (!audioMessage) return null;

  const durationSeconds = Number(audioMessage.seconds);
  return {
    durationSeconds:
      Number.isFinite(durationSeconds) && durationSeconds >= 0 ? durationSeconds : null,
  };
}

export function shouldForwardAudio(audioInfo, minimumSeconds = 10) {
  return (
    audioInfo?.durationSeconds !== null &&
    Number.isFinite(audioInfo?.durationSeconds) &&
    audioInfo.durationSeconds >= minimumSeconds
  );
}

export function buildAudioBatchDecision({
  longAudioMessages = [],
  shortAudioCount = 0,
  textMessageCount = 0,
  forcedHandoffReason = null,
} = {}) {
  const safeLongAudios = Array.isArray(longAudioMessages) ? longAudioMessages : [];
  const hasLongAudio = safeLongAudios.length > 0;
  const canApplyAutomaticAudioReply = !forcedHandoffReason;

  return {
    hasLongAudio,
    canApplyAutomaticAudioReply,
    onlyShortAudios:
      canApplyAutomaticAudioReply &&
      shortAudioCount > 0 &&
      textMessageCount === 0 &&
      !hasLongAudio,
    // El reenvío no depende de los límites de texto o frecuencia.
    supportMessagesToForward: [...safeLongAudios],
  };
}

export function getMessageTimestampMs(message) {
  const timestamp = Number(message?.messageTimestamp);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  return timestamp > 1_000_000_000_000 ? timestamp : timestamp * 1000;
}

export function isMessageFromCurrentStartup(
  message,
  botStartedAtMs,
  clockToleranceMs = 10_000
) {
  const messageTimestampMs = getMessageTimestampMs(message);
  if (!Number.isFinite(messageTimestampMs) || !Number.isFinite(botStartedAtMs)) return false;
  return messageTimestampMs >= botStartedAtMs - clockToleranceMs;
}

export function shouldRecordManualMessage({
  hasPendingMessages = false,
  hasActiveProcessing = false,
  conversation = null,
  messageTimestampMs = null,
  botStartedAtMs = null,
  clockToleranceMs = 10_000,
} = {}) {
  const belongsToActiveHandoff =
    conversation?.managedByBot === true && conversation?.awaitingHuman === true;
  if (!hasPendingMessages && !hasActiveProcessing && !belongsToActiveHandoff) return false;
  if (!Number.isFinite(messageTimestampMs) || !Number.isFinite(botStartedAtMs)) return false;
  return messageTimestampMs >= botStartedAtMs - clockToleranceMs;
}

export function buildCustomerGreeting(contactName) {
  return contactName
    ? `¡Hola, ${contactName}! Gracias por escribirnos 😊`
    : "¡Hola! Gracias por escribirnos 😊";
}

export function shouldIgnoreRemoteJid(remoteJid) {
  if (!remoteJid || typeof remoteJid !== "string") return true;
  return (
    remoteJid === "status@broadcast" ||
    remoteJid.endsWith("@g.us") ||
    remoteJid.endsWith("@broadcast") ||
    remoteJid.endsWith("@newsletter")
  );
}

export function messageMatchesJid(messageKey, targetJids = []) {
  if (!messageKey || !Array.isArray(targetJids) || targetJids.length === 0) return false;
  const targets = new Set(targetJids.filter(Boolean));
  return [messageKey.remoteJid, messageKey.senderPn, messageKey.participantPn]
    .filter(Boolean)
    .some((jid) => targets.has(jid));
}

export function createMessageDeduplicator({ ttlMs = 10 * 60 * 1000, maxEntries = 5000 } = {}) {
  const seen = new Map();

  return function isDuplicate(messageId, now = Date.now()) {
    if (!messageId) return false;

    const previous = seen.get(messageId);
    if (previous !== undefined && now - previous < ttlMs) return true;

    seen.set(messageId, now);

    if (seen.size > maxEntries) {
      for (const [id, timestamp] of seen) {
        if (now - timestamp >= ttlMs || seen.size > maxEntries) {
          seen.delete(id);
        }
      }
    }

    return false;
  };
}

export function createRateLimiter({ limit, windowMs }) {
  const activity = new Map();

  return function allow(key, now = Date.now()) {
    const recent = (activity.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
    if (recent.length >= limit) {
      activity.set(key, recent);
      return false;
    }

    recent.push(now);
    activity.set(key, recent);
    return true;
  };
}

export function createOutgoingMessageTracker({ ttlMs = 60 * 1000 } = {}) {
  const messageIds = new Map();
  const fingerprints = new Map();

  const fingerprintFor = (remoteJid, content) => {
    const text = typeof content === "string"
      ? content
      : typeof content?.text === "string"
        ? content.text
        : "";
    return `${remoteJid}\n${text}`;
  };

  const removeFingerprint = (fingerprint) => {
    const count = fingerprints.get(fingerprint) || 0;
    if (count <= 1) fingerprints.delete(fingerprint);
    else fingerprints.set(fingerprint, count - 1);
  };

  const cleanup = (now) => {
    for (const [id, expiresAt] of messageIds) {
      if (expiresAt <= now) messageIds.delete(id);
    }
  };

  return {
    prepare(remoteJid, content) {
      const fingerprint = fingerprintFor(remoteJid, content);
      fingerprints.set(fingerprint, (fingerprints.get(fingerprint) || 0) + 1);
      return { fingerprint };
    },

    markSent(token, messageId, now = Date.now()) {
      removeFingerprint(token.fingerprint);
      if (messageId) messageIds.set(messageId, now + ttlMs);
      cleanup(now);
    },

    markFailed(token) {
      removeFingerprint(token.fingerprint);
    },

    consumeIfAutomated({ remoteJid, messageId, text }, now = Date.now()) {
      cleanup(now);

      if (messageId && messageIds.has(messageId)) {
        messageIds.delete(messageId);
        return true;
      }

      const fingerprint = fingerprintFor(remoteJid, { text });
      if (fingerprints.has(fingerprint)) {
        removeFingerprint(fingerprint);
        return true;
      }

      return false;
    },
  };
}
