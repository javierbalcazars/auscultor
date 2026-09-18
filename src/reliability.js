function defaultWait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function computeReconnectDelay(attempt, { baseMs = 1000, maxMs = 30000 } = {}) {
  return Math.min(baseMs * 2 ** Math.max(0, attempt), maxMs);
}

export function createMessageSender({
  getSocket,
  outgoingTracker,
  wait = defaultWait,
  retryDelays = [0, 1000, 3000],
  onAttemptFailure = () => {},
}) {
  return async function sendMessageWithRetry(remoteJid, content) {
    let lastError = null;

    for (let index = 0; index < retryDelays.length; index += 1) {
      const delayMs = retryDelays[index];
      if (delayMs > 0) await wait(delayMs);

      const socket = getSocket();
      if (!socket) {
        lastError = new Error("WhatsApp no tiene una conexión activa");
        onAttemptFailure({ remoteJid, attempt: index + 1, maxAttempts: retryDelays.length, error: lastError });
        continue;
      }

      const trackingToken = outgoingTracker.prepare(remoteJid, content);
      try {
        const sentMessage = await socket.sendMessage(remoteJid, content);
        outgoingTracker.markSent(trackingToken, sentMessage?.key?.id);
        return sentMessage;
      } catch (error) {
        outgoingTracker.markFailed(trackingToken);
        lastError = error;
        onAttemptFailure({ remoteJid, attempt: index + 1, maxAttempts: retryDelays.length, error });
      }
    }

    throw lastError || new Error("No se pudo enviar el mensaje por WhatsApp");
  };
}
