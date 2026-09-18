import test from "node:test";
import assert from "node:assert/strict";
import { createOutgoingMessageTracker } from "../src/messageUtils.js";
import { computeReconnectDelay, createMessageSender } from "../src/reliability.js";

test("reintenta con la conexión activa más reciente hasta entregar", async () => {
  let attempts = 0;
  const delays = [];
  const failures = [];
  const socket = {
    async sendMessage() {
      attempts += 1;
      if (attempts < 3) throw new Error("fallo temporal");
      return { key: { id: "enviado" } };
    },
  };
  const send = createMessageSender({
    getSocket: () => socket,
    outgoingTracker: createOutgoingMessageTracker(),
    wait: async (ms) => delays.push(ms),
    onAttemptFailure: (failure) => failures.push(failure),
  });

  const result = await send("cliente", { text: "Hola" });
  assert.equal(result.key.id, "enviado");
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [1000, 3000]);
  assert.equal(failures.length, 2);
});

test("falla de forma controlada cuando no existe una conexión", async () => {
  const send = createMessageSender({
    getSocket: () => null,
    outgoingTracker: createOutgoingMessageTracker(),
    wait: async () => {},
  });
  await assert.rejects(() => send("cliente", { text: "Hola" }), /conexión activa/);
});

test("la espera de reconexión crece y se limita a 30 segundos", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((attempt) => computeReconnectDelay(attempt)), [
    1000,
    2000,
    4000,
    8000,
    16000,
    30000,
    30000,
  ]);
});
