import test from "node:test";
import assert from "node:assert/strict";
import { installSignalLogFilter } from "../src/signalLogFilter.js";

function fakeConsole(output) {
  return {
    info: (...args) => output.push(["info", ...args]),
    warn: (...args) => output.push(["warn", ...args]),
    error: (...args) => output.push(["error", ...args]),
  };
}

test("oculta claves e informa MessageCounterError de forma segura", () => {
  const output = [];
  const targetConsole = fakeConsole(output);
  const diagnostics = installSignalLogFilter({
    targetConsole,
    now: () => 120_000,
    warningCooldownMs: 60_000,
  });

  targetConsole.info("Closing session:", { privateKey: "secreta" });
  targetConsole.warn("Closing open session in favor of incoming prekey bundle");
  targetConsole.error("Failed to decrypt message with any known session...");
  targetConsole.error("Session error:MessageCounterError: clave utilizada", "traza sensible");
  diagnostics.markConnected();
  targetConsole.error("Error normal", "detalle");
  diagnostics.restore();

  assert.equal(JSON.stringify(output).includes("secreta"), false);
  assert.equal(JSON.stringify(output).includes("traza sensible"), false);
  assert.equal(output.filter((entry) => entry[0] === "warn").length, 1);
  assert.match(String(output[0][1]), /MessageCounterError=1/);
  assert.deepEqual(output.at(-1), ["error", "Error normal", "detalle"]);
  assert.deepEqual(diagnostics.getSummary(), {
    decryptFailures: 1,
    errorTypes: { MessageCounterError: 1 },
  });
});

test("informa errores desconocidos al iniciar sin revelar su traza", () => {
  const output = [];
  const targetConsole = fakeConsole(output);
  const diagnostics = installSignalLogFilter({ targetConsole });

  targetConsole.error("Failed to decrypt message with any known session...");
  targetConsole.error("Session error:Error: Bad MAC", "privKey: secreta");
  diagnostics.markConnected();

  assert.equal(JSON.stringify(output).includes("secreta"), false);
  assert.match(String(output[0][1]), /BadMACError=1/);
  diagnostics.restore();
});

test("informa de forma segura un error ocurrido durante la conexión activa", () => {
  const output = [];
  const targetConsole = fakeConsole(output);
  let currentTime = 120_000;
  const diagnostics = installSignalLogFilter({ targetConsole, now: () => currentTime });
  diagnostics.markConnected();
  currentTime += 31_000;

  targetConsole.error("Failed to decrypt message with any known session...");
  targetConsole.error("Session error:MessageCounterError: clave utilizada", "traza sensible");

  assert.equal(JSON.stringify(output).includes("traza sensible"), false);
  assert.match(String(output[0][1]), /MessageCounterError/);
  diagnostics.restore();
});

test("descarta repeticiones conocidas durante la sincronización posterior a conectar", () => {
  const output = [];
  const targetConsole = fakeConsole(output);
  const diagnostics = installSignalLogFilter({ targetConsole, now: () => 120_000 });
  diagnostics.markConnected();

  targetConsole.error("Failed to decrypt message with any known session...");
  targetConsole.error("Session error:MessageCounterError: clave utilizada", "traza sensible");

  assert.equal(output.length, 1);
  assert.match(String(output[0][1]), /MessageCounterError/);
  assert.equal(diagnostics.getSummary().decryptFailures, 1);
  diagnostics.restore();
});

test("entrega la sesión exacta para repararla y permite reiniciar el diagnóstico", () => {
  const output = [];
  const targetConsole = fakeConsole(output);
  const diagnostics = installSignalLogFilter({ targetConsole });

  targetConsole.error("Failed to decrypt message with any known session...");
  targetConsole.error(
    "Session error:Error: Bad MAC\n    at async 28475767398580.64 [as awaitable]"
  );

  assert.deepEqual(diagnostics.takeRepairableSessionAddresses(), ["28475767398580.64"]);
  assert.deepEqual(diagnostics.takeRepairableSessionAddresses(), []);
  diagnostics.resetForRetry();
  assert.deepEqual(diagnostics.getSummary(), { decryptFailures: 0, errorTypes: {} });
  diagnostics.restore();
});
