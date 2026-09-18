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

test("persiste el avance para no repetir destinatarios ya notificados", async () => {
  const saved = [];
  const recipients = ["56911111111@s.whatsapp.net", "56922222222@s.whatsapp.net"];
  let secondAvailable = false;
  const queue = createHumanAlertRetryQueue({
    deliver: async (payload, persistProgress) => {
      payload.deliveredSupportJids ||= [];
      for (const recipient of recipients) {
        if (payload.deliveredSupportJids.includes(recipient)) continue;
        if (recipient === recipients[1] && !secondAvailable) throw new Error("sin conexión");
        payload.deliveredSupportJids.push(recipient);
        persistProgress();
      }
    },
    store: { save: (alerts) => saved.push(JSON.parse(JSON.stringify(alerts))), load: () => [] },
    setTimer: () => ({ unref() {} }),
    clearTimer: () => {},
  });
  const payload = { remoteJid: "cliente@lid", text: "Ayuda", deliveredSupportJids: [] };
  await queue.sendOrQueue(payload);
  assert.deepEqual(payload.deliveredSupportJids, [recipients[0]]);
  secondAvailable = true;
  await queue.flush();
  assert.deepEqual(payload.deliveredSupportJids, recipients);
  assert.ok(saved.some((alerts) => alerts[0]?.deliveredSupportJids?.length === 1));
});
