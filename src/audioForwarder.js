import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { unwrapMessage } from "./messageUtils.js";

/**
 * Descarga un audio cifrado a memoria y genera un mensaje nuevo. De esta forma
 * WhatsApp crea claves de cifrado válidas para el número del encargado.
 */
export async function prepareAudioForResend({
  message,
  socket,
  logger,
  download = downloadMediaMessage,
}) {
  const audioMessage = unwrapMessage(message?.message).audioMessage;
  if (!audioMessage) throw new Error("El mensaje recibido no contiene un audio");
  if (!socket) throw new Error("WhatsApp no tiene una conexión activa");

  const downloaded = await download(message, "buffer", {}, {
    logger,
    reuploadRequest: (mediaMessage) => socket.updateMediaMessage(mediaMessage),
  });
  const audio = Buffer.isBuffer(downloaded) ? downloaded : Buffer.from(downloaded);
  if (audio.length === 0) throw new Error("WhatsApp entregó un audio vacío");

  return {
    audio,
    mimetype: audioMessage.mimetype || "audio/ogg; codecs=opus",
    ptt: Boolean(audioMessage.ptt),
  };
}
