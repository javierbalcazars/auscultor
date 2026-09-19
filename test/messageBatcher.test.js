import test from "node:test";
import assert from "node:assert/strict";
import { createMessageBatcher } from "../src/messageBatcher.js";

test("agrupa textos y prepara decisiones de audio antes de procesar", async () => {
  const flushed = [];
  const batcher = createMessageBatcher({
    maxBatchMessages: 2,
    maxInputChars: 100,
    responseDelayMs: 1000,
    audioForwardMinSeconds: 10,
    allowRequest: () => true,
    onFlush: (value) => flushed.push(value),
    shortAudioReply: "Escribe tu consulta.",
    longAudioReply: "Audio derivado.",
  });
  batcher.add({ remoteJid: "cliente", text: "Hola", pushName: "Cliente" });
  assert.equal(batcher.has("cliente"), true);
  batcher.add({ remoteJid: "cliente", text: "¿Hay estacionamiento?", pushName: "Cliente" });
  assert.equal(flushed.length, 1);
  assert.equal(flushed[0].modelText, "Hola\n¿Hay estacionamiento?");
  assert.equal(batcher.has("cliente"), false);

  const message = { id: "audio" };
  batcher.add({ remoteJid: "audio", text: "[Audio]", audioInfo: { durationSeconds: 12 }, message });
  const pendingText = batcher.cancel("audio");
  assert.equal(pendingText, "[Audio]");
});
