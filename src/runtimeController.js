import { computeReconnectDelay } from "./reliability.js";

export function createRuntimeController({
  connect,
  getLoggedOut = () => false,
  writeStatus,
  onReconnectScheduled = () => {},
  onReconnectFailure = () => {},
  processRef = process,
} = {}) {
  let stopping = false;
  let reconnectTimer = null;
  let reconnectAttempts = 0;
  let releaseLock = null;
  let keepAliveTimer = null;
  let handlersInstalled = false;

  function fatal(type, error) {
    if (stopping) return;
    stopping = true;
    console.error(`❌ Error fatal no controlado (${type}):`, error);
    console.error("El bot se cerrará para evitar continuar en un estado inconsistente.");
    processRef.exitCode = 1;
    setTimeout(() => processRef.exit(1), 100).unref();
  }

  function cleanup({ preserveLoggedOut = false } = {}) {
    stopping = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (keepAliveTimer) clearInterval(keepAliveTimer);
    reconnectTimer = null;
    keepAliveTimer = null;
    releaseLock?.();
    writeStatus?.("stopped", preserveLoggedOut ? { whatsappLoggedOut: getLoggedOut() } : {}, {
      onlyIfCurrentProcess: true,
    });
  }

  function installProcessHandlers() {
    if (handlersInstalled) return;
    handlersInstalled = true;
    processRef.on("unhandledRejection", (reason) => fatal("unhandledRejection", reason));
    processRef.on("uncaughtException", (error) => fatal("uncaughtException", error));
    processRef.once("exit", () => cleanup({ preserveLoggedOut: true }));
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
      processRef.once(signal, () => {
        cleanup();
        processRef.exit(0);
      });
    }
  }

  function scheduleReconnect() {
    if (reconnectTimer || stopping) return false;
    const delayMs = computeReconnectDelay(reconnectAttempts);
    reconnectAttempts += 1;
    onReconnectScheduled(delayMs);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      Promise.resolve(connect()).catch((error) => {
        onReconnectFailure(error);
        scheduleReconnect();
      });
    }, delayMs);
    return true;
  }

  function markConnected() {
    reconnectAttempts = 0;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  function startKeepAlive() {
    if (!keepAliveTimer) keepAliveTimer = setInterval(() => {}, 60_000);
  }

  return {
    fatal,
    installProcessHandlers,
    isStopping: () => stopping,
    markConnected,
    scheduleReconnect,
    setReleaseLock(callback) { releaseLock = callback; },
    startKeepAlive,
  };
}
