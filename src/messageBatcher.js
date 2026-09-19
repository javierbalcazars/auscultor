import { buildAudioBatchDecision, shouldForwardAudio } from "./messageUtils.js";

export function createMessageBatcher({
  maxBatchMessages,
  maxInputChars,
  responseDelayMs,
  audioForwardMinSeconds,
  allowRequest,
  onRateLimited = () => {},
  onFlush,
  shortAudioReply,
  longAudioReply,
}) {
  const pending = new Map();

  function cancel(remoteJid) {
    const batch = pending.get(remoteJid);
    if (!batch) return "";
    if (batch.timer) clearTimeout(batch.timer);
    pending.delete(remoteJid);
    return batch.texts.join("\n").slice(0, maxInputChars);
  }

  function flush(remoteJid, batch) {
    if (pending.get(remoteJid) !== batch) return;
    pending.delete(remoteJid);
    const exceededInputLimit = batch.totalChars > maxInputChars;
    const combinedText = batch.texts.join("\n").slice(0, maxInputChars);
    const combinedModelText = batch.modelTexts.join("\n").slice(0, maxInputChars);
    const allowedByRateLimit = allowRequest(remoteJid);
    if (!allowedByRateLimit) onRateLimited(remoteJid);
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
          handoffReason: `El cliente envió un audio de ${audioForwardMinSeconds} segundos o más.`,
        }
      : audioDecision.onlyShortAudios
        ? { reply: "", needsHuman: false, handoffReason: "" }
        : null;
    const forcedReply = audioDecision.hasLongAudio && audioDecision.canApplyAutomaticAudioReply
      ? longAudioReply
      : audioDecision.onlyShortAudios
        ? shortAudioReply
        : null;
    const replyPrefix = audioDecision.canApplyAutomaticAudioReply &&
      batch.shortAudioCount > 0 && batch.modelTexts.length > 0
      ? shortAudioReply
      : "";

    onFlush({
      remoteJid,
      text: combinedText,
      modelText: combinedModelText || combinedText,
      pushName: batch.pushName,
      forcedHandoffReason,
      presetResult,
      forcedReply,
      replyPrefix,
      supportMessagesToForward: audioDecision.supportMessagesToForward,
    });
  }

  function add({ remoteJid, text, audioInfo, message, pushName }) {
    const existing = pending.get(remoteJid);
    if (existing?.timer) clearTimeout(existing.timer);
    const batch = existing || {
      texts: [], modelTexts: [], shortAudioCount: 0, longAudioMessages: [],
      totalChars: 0, pushName, timer: null,
    };
    batch.texts.push(text);
    if (audioInfo) {
      if (shouldForwardAudio(audioInfo, audioForwardMinSeconds)) batch.longAudioMessages.push(message);
      else batch.shortAudioCount += 1;
    } else {
      batch.modelTexts.push(text);
    }
    batch.totalChars += text.length + (batch.texts.length > 1 ? 1 : 0);
    if (!batch.pushName && pushName) batch.pushName = pushName;
    pending.set(remoteJid, batch);

    if (batch.texts.length >= maxBatchMessages || batch.totalChars >= maxInputChars) {
      flush(remoteJid, batch);
    } else {
      batch.timer = setTimeout(() => flush(remoteJid, batch), responseDelayMs);
    }
  }

  return { add, cancel, has: (remoteJid) => pending.has(remoteJid) };
}
