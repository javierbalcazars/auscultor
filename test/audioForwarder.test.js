import test from "node:test";
import assert from "node:assert/strict";
import { prepareAudioForResend } from "../src/audioForwarder.js";

test("descarga el audio a memoria y prepara una nota de voz nueva", async () => {
  const message = {
    key: { id: "audio-1" },
    message: {
      audioMessage: {
        mimetype: "audio/ogg; codecs=opus",
        ptt: true,
      },
    },
  };
  const socket = {
    updateMediaMessage: async (value) => value,
  };
  let receivedContext = null;

  const content = await prepareAudioForResend({
    message,
    socket,
    logger: { level: "silent" },
    download: async (receivedMessage, type, options, context) => {
      assert.equal(receivedMessage, message);
      assert.equal(type, "buffer");
      assert.deepEqual(options, {});
      receivedContext = context;
      return Buffer.from("audio-prueba");
    },
  });

  assert.equal(typeof receivedContext.reuploadRequest, "function");
  assert.deepEqual(content.audio, Buffer.from("audio-prueba"));
  assert.equal(content.mimetype, "audio/ogg; codecs=opus");
  assert.equal(content.ptt, true);
});

test("rechaza mensajes que no contienen audio", async () => {
  await assert.rejects(
    prepareAudioForResend({
      message: { message: { conversation: "Hola" } },
      socket: {},
      logger: {},
      download: async () => Buffer.from("contenido"),
    }),
    /no contiene un audio/
  );
});
