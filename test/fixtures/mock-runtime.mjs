// Se carga únicamente en los procesos aislados de bot.integration.test.js.
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@whiskeysockets/baileys") {
      return { url: new URL("./mock-whatsapp.mjs", import.meta.url).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

globalThis.fetch = async (url, options) => {
  if (url !== "https://api.openai.com/v1/chat/completions") {
    throw new Error("Las pruebas no permiten conexiones externas");
  }
  const request = JSON.parse(options.body);
  process.send({ event: "llm", request });
  if (process.env.MOCK_LLM_MANUAL === "1") {
    await new Promise((resolve, reject) => {
      const cleanup = () => {
        process.off("message", onCommand);
        options.signal.removeEventListener("abort", onAbort);
      };
      const onCommand = (command) => {
        if (command.type !== "answer") return;
        cleanup();
        resolve();
      };
      const onAbort = () => {
        cleanup();
        reject(new DOMException("Interrumpido", "AbortError"));
      };
      process.on("message", onCommand);
      options.signal.addEventListener("abort", onAbort, { once: true });
    });
  }
  const needsHuman = /reservar/i.test(request.messages.at(-1).content);
  return { ok: true, json: async () => ({ choices: [{
    finish_reason: "stop",
    message: { content: JSON.stringify({
      reply: needsHuman ? "" : "Unimarc está a 10 minutos en vehículo.",
      needs_human: needsHuman,
      handoff_reason: needsHuman ? "Se requiere revisar disponibilidad." : "",
    }) },
  }] }) };
};
