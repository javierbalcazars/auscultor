import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHumanAlertStore } from "../src/humanAlertStore.js";
import { createHumanAlertRetryQueue } from "../src/humanAlertRetry.js";

const alert = {
  remoteJid: "123456@lid", contactName: "Cliente", text: "Necesito cambiar la reserva",
  reason: "Revisión de disponibilidad", createdAt: "2026-09-16T15:30:00.000Z",
  deliveredSupportJids: [],
};
const timers = { setTimer: () => ({ unref() {} }), clearTimer: () => {} };

function storage(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bot-alerts-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "data", "pending-human-alerts.json");
  return { file, store: createHumanAlertStore(file) };
}

test("guarda antes del envío, recupera tras reiniciar y borra solo al entregar", async (t) => {
  const { file, store } = storage(t);
  const first = createHumanAlertRetryQueue({ ...timers, store, deliver: async () => {
    assert.deepEqual(store.load(), [alert]);
    throw new Error("sin conexión");
  } });
  assert.equal(first.restore(), 0);
  await first.sendOrQueue(alert);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.equal(fs.statSync(path.dirname(file)).mode & 0o777, 0o700);

  const sent = [];
  const restarted = createHumanAlertRetryQueue({ ...timers, store, deliver: async (payload) => sent.push(payload) });
  assert.equal(restarted.restore(), 1);
  await restarted.flush();
  assert.deepEqual(sent, [alert]);
  assert.deepEqual(store.load(), []);
  assert.equal(restarted.size(), 0);
});

test("un archivo dañado detiene la recuperación sin sobrescribirlo", (t) => {
  const { file, store } = storage(t);
  fs.mkdirSync(path.dirname(file));
  fs.writeFileSync(file, "{roto");
  assert.throws(() => store.load(), /dañado/);
  assert.equal(fs.readFileSync(file, "utf8"), "{roto");
});

test("si no se puede persistir, no se informa una alerta como encolada", async () => {
  let sends = 0;
  const queue = createHumanAlertRetryQueue({ ...timers,
    store: { save() { throw new Error("disco lleno"); } },
    deliver: async () => { sends += 1; },
  });
  assert.throws(() => queue.sendOrQueue(alert), /disco lleno/);
  assert.equal(queue.size(), 0);
  assert.equal(sends, 0);
});

test("un reintento concurrente no duplica la alerta y conserva la actualización", async (t) => {
  const { store } = storage(t);
  let finishFirst;
  const sent = [];
  const gate = new Promise((resolve) => { finishFirst = resolve; });
  const queue = createHumanAlertRetryQueue({ ...timers, store, deliver: async (payload) => {
    sent.push(payload.text);
    if (sent.length === 1) await gate;
  } });
  const first = queue.sendOrQueue(alert);
  await Promise.resolve();
  const flush = queue.flush();
  const latest = { ...alert, text: "Nueva consulta" };
  const second = queue.sendOrQueue(latest);
  assert.deepEqual(store.load(), [latest]);
  finishFirst();
  await Promise.all([first, flush, second]);
  assert.deepEqual(sent, [alert.text, latest.text]);
  assert.deepEqual(store.load(), []);
});

test("un fallo al registrar la entrega no vuelve a enviar la misma alerta", async (t) => {
  const { store } = storage(t);
  let sent = 0;
  const queue = createHumanAlertRetryQueue({ ...timers, store,
    deliver: async () => { sent += 1; },
    onDelivered: async () => { throw new Error("falló el registro del chat"); },
  });
  await assert.rejects(queue.sendOrQueue(alert), /registro/);
  await queue.flush();
  assert.equal(sent, 1);
  assert.deepEqual(store.load(), []);
});
