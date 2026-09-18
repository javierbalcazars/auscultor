import { EventEmitter } from "node:events";

export const DisconnectReason = {
  loggedOut: 401, badSession: 500, connectionReplaced: 440, connectionClosed: 428,
  connectionLost: 408, restartRequired: 515, timedOut: 408,
};
export async function useMultiFileAuthState() {
  return { state: {}, saveCreds: async () => {} };
}
export async function downloadMediaMessage() {
  return Buffer.from("audio simulado");
}

let nextId = 0;
export default function makeWASocket() {
  const ev = new EventEmitter();
  const onCommand = (command) => {
    if (command.type === "message") {
      ev.emit("messages.upsert", { type: "notify", messages: [command.message] });
    }
  };
  process.on("message", onCommand);
  setTimeout(() => ev.emit("connection.update", { connection: "open" }), 10);
  return {
    ev,
    async sendMessage(jid, content) {
      if (process.env.MOCK_FAIL_SUPPORT === "1" && jid === `${process.env.HUMAN_SUPPORT_NUMBER}@s.whatsapp.net`) {
        process.send({ event: "send-failed", jid });
        throw new Error("Desconexión simulada del encargado");
      }
      process.send({ event: "sent", jid, text: content.text, audio: Boolean(content.audio) });
      return { key: { id: `outgoing-${++nextId}` } };
    },
    end() {
      process.off("message", onCommand);
      ev.emit("connection.update", { connection: "close" });
    },
    async updateMediaMessage(message) { return message; },
  };
}
