/**
 * Mantiene las alertas humanas que no pudieron entregarse y vuelve
 * a intentarlo periódicamente. Una alerta nueva del mismo chat reemplaza a la
 * anterior para evitar avisos duplicados u obsoletos.
 */
export function createHumanAlertRetryQueue({
  deliver,
  onDelivered = async () => {},
  onFailure = () => {},
  retryDelayMs = 60_000,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  store = null,
} = {}) {
  if (typeof deliver !== "function") {
    throw new Error("La cola de alertas requiere una función de entrega");
  }

  const pending = new Map();
  const inFlight = new Map();
  let retryTimer = null;
  let flushInProgress = null;

  function persist() {
    store?.save([...pending.values()]);
  }

  function scheduleRetry() {
    if (retryTimer || pending.size === 0) return;
    retryTimer = setTimer(() => {
      retryTimer = null;
      void flush();
    }, retryDelayMs);
    retryTimer?.unref?.();
  }

  async function attempt(payload) {
    const running = inFlight.get(payload.remoteJid);
    if (running) {
      if (running.payload === payload) return running.promise;
      await running.promise;
      return attempt(payload);
    }
    if (pending.get(payload.remoteJid) !== payload) {
      return { sent: false, superseded: true, error: null };
    }

    const promise = Promise.resolve().then(async () => {
      try {
        await deliver(payload);
      } catch (error) {
        onFailure(payload, error);
        return { sent: false, error };
      }
      if (pending.get(payload.remoteJid) === payload) {
        pending.delete(payload.remoteJid);
        persist();
      }
      // Un error al actualizar el chat no debe reenviar una alerta ya entregada.
      await onDelivered(payload);
      return { sent: true, error: null };
    }).finally(() => {
      inFlight.delete(payload.remoteJid);
      scheduleRetry();
    });
    inFlight.set(payload.remoteJid, { payload, promise });
    return promise;
  }

  async function flush() {
    if (flushInProgress) return flushInProgress;
    if (retryTimer) {
      clearTimer(retryTimer);
      retryTimer = null;
    }

    flushInProgress = (async () => {
      for (const payload of [...pending.values()]) {
        await attempt(payload);
      }
    })().finally(() => {
      flushInProgress = null;
      scheduleRetry();
    });

    return flushInProgress;
  }

  return {
    // Llamar después de adquirir el candado del proceso y antes de conectar.
    restore() {
      if (pending.size || inFlight.size) throw new Error("La cola ya está en uso");
      for (const payload of store?.load() || []) {
        pending.set(payload.remoteJid, payload);
      }
      return pending.size;
    },
    sendOrQueue(payload) {
      const previous = pending.get(payload.remoteJid);
      pending.set(payload.remoteJid, payload);
      try {
        persist();
      } catch (error) {
        if (previous) pending.set(payload.remoteJid, previous);
        else pending.delete(payload.remoteJid);
        throw error;
      }
      return attempt(payload);
    },
    flush,
    has(remoteJid) {
      return pending.has(remoteJid);
    },
    size() {
      return pending.size;
    },
  };
}
