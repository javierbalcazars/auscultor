import test from "node:test";
import assert from "node:assert/strict";
import { createHumanAlertRetryQueue } from "../src/humanAlertRetry.js";

test("conserva una alerta fallida y la elimina solamente después de entregarla", async () => {
  let attempts = 0;
  const delivered = [];
  const failures = [];
  const queue = createHumanAlertRetryQueue({
    deliver: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("sin conexión");
    },
    onDelivered: async (payload) => delivered.push(payload.remoteJid),
    onFailure: (payload) => failures.push(payload.remoteJid),
    setTimer: () => ({ unref() {} }),
    clearTimer: () => {},
  });

  const first = await queue.sendOrQueue({ remoteJid: "cliente@lid", text: "Ayuda" });
  assert.equal(first.sent, false);
  assert.equal(queue.size(), 1);

  await queue.flush();
  assert.equal(queue.size(), 0);
  assert.equal(attempts, 2);
  assert.deepEqual(failures, ["cliente@lid"]);
  assert.deepEqual(delivered, ["cliente@lid"]);
});

test("mantiene una sola alerta pendiente por chat y conserva la más reciente", async () => {
  let connectionAvailable = false;
  const deliveredTexts = [];
  const queue = createHumanAlertRetryQueue({
    deliver: async (payload) => {
      if (!connectionAvailable) throw new Error("sin conexión");
      deliveredTexts.push(payload.text);
    },
    setTimer: () => ({ unref() {} }),
    clearTimer: () => {},
  });

  await queue.sendOrQueue({ remoteJid: "cliente@lid", text: "Primera consulta" });
  await queue.sendOrQueue({ remoteJid: "cliente@lid", text: "Consulta actualizada" });
  assert.equal(queue.size(), 1);

  connectionAvailable = true;
  await queue.flush();
  assert.deepEqual(deliveredTexts, ["Consulta actualizada"]);
  assert.equal(queue.size(), 0);
});
