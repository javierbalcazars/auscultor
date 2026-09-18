import { extractSignalSessionAddress } from "./signalSessionRepair.js";

const DECRYPT_FAILURE = "Failed to decrypt message with any known session...";
const SESSION_ERROR_PREFIX = "Session error:";
const SENSITIVE_INFO_PREFIXES = ["Closing session:"];
const SENSITIVE_WARN_PREFIXES = [
  "Closing open session in favor of incoming prekey bundle",
  "Session already closed",
];

function safeErrorType(text) {
  if (text.includes("MessageCounterError")) return "MessageCounterError";
  if (text.includes("Bad MAC")) return "BadMACError";
  return text.match(/\b([A-Za-z][A-Za-z0-9]*Error)\b/)?.[1] || "UnknownSessionError";
}

/**
 * libsignal escribe directamente en console y puede imprimir claves internas.
 * El filtro conserva diagnósticos seguros, pero descarta estructuras sensibles.
 */
export function installSignalLogFilter({
  targetConsole = console,
  now = () => Date.now(),
  warningCooldownMs = 60_000,
} = {}) {
  const original = {
    info: targetConsole.info.bind(targetConsole),
    warn: targetConsole.warn.bind(targetConsole),
    error: targetConsole.error.bind(targetConsole),
  };
  const errorTypes = new Map();
  const repairableSessionAddresses = new Set();
  let decryptFailures = 0;
  let connectionEstablished = false;
  let lastLiveWarning = 0;

  const summary = () => ({
    decryptFailures,
    errorTypes: Object.fromEntries(errorTypes),
  });

  const reportStartupErrors = () => {
    if (decryptFailures === 0) return;
    const types = errorTypes.size > 0
      ? [...errorTypes.entries()].map(([type, count]) => `${type}=${count}`).join(", ")
      : "tipo no identificado";
    original.warn(
      `⚠️ Diagnóstico de cifrado de WhatsApp: ${decryptFailures} mensaje(s) omitido(s); ${types}.`
    );
  };

  targetConsole.info = (...args) => {
    const first = String(args[0] || "");
    if (SENSITIVE_INFO_PREFIXES.some((prefix) => first.startsWith(prefix))) return;
    original.info(...args);
  };

  targetConsole.warn = (...args) => {
    const first = String(args[0] || "");
    if (SENSITIVE_WARN_PREFIXES.some((prefix) => first.startsWith(prefix))) return;
    original.warn(...args);
  };

  targetConsole.error = (...args) => {
    const first = String(args[0] || "");
    if (first === DECRYPT_FAILURE) {
      decryptFailures += 1;
      return;
    }
    if (first.startsWith(SESSION_ERROR_PREFIX)) {
      const type = safeErrorType(first);
      errorTypes.set(type, (errorTypes.get(type) || 0) + 1);
      const sessionAddress = extractSignalSessionAddress(args.map(String).join("\n"));
      if (sessionAddress) repairableSessionAddresses.add(sessionAddress);

      if (connectionEstablished) {
        const currentTime = now();
        if (currentTime - lastLiveWarning >= warningCooldownMs || lastLiveWarning === 0) {
          lastLiveWarning = currentTime;
          original.warn(
            `⚠️ Error de cifrado de WhatsApp durante la conexión [${type}]. Mensaje omitido.`
          );
        }
      }
      return;
    }
    original.error(...args);
  };

  return {
    markConnected() {
      if (connectionEstablished) return;
      reportStartupErrors();
      connectionEstablished = true;
    },
    markConnectionFailed() {
      if (connectionEstablished) return;
      reportStartupErrors();
    },
    takeRepairableSessionAddresses() {
      const addresses = [...repairableSessionAddresses];
      repairableSessionAddresses.clear();
      return addresses;
    },
    resetForRetry() {
      decryptFailures = 0;
      errorTypes.clear();
      repairableSessionAddresses.clear();
      connectionEstablished = false;
      lastLiveWarning = 0;
    },
    getSummary: summary,
    restore() {
      targetConsole.info = original.info;
      targetConsole.warn = original.warn;
      targetConsole.error = original.error;
    },
  };
}
