import fs from "node:fs";
import dotenv from "dotenv";
import { ENV_PATH } from "../config.js";

export function createOpenAiHealthChecker({ envPath = ENV_PATH, fetchImpl = fetch, cacheMs = 60_000 } = {}) {
  let cache = { checkedAt: 0, valid: false };
  return {
    async check() {
      if (Date.now() - cache.checkedAt < cacheMs) return cache.valid;
      try {
        const environment = fs.existsSync(envPath) ? dotenv.parse(fs.readFileSync(envPath)) : {};
        const apiKey = environment.OPENAI_API_KEY?.trim();
        const model = environment.OPENAI_MODEL?.trim() || "gpt-4o-mini";
        if (!apiKey || apiKey === "sk-xxxxxxxx") throw new Error("Falta la clave");
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        let response;
        try {
          response = await fetchImpl(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, {
            headers: { Authorization: `Bearer ${apiKey}` }, signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }
        cache = { checkedAt: Date.now(), valid: response.ok };
      } catch {
        cache = { checkedAt: Date.now(), valid: false };
      }
      return cache.valid;
    },
    reset() {
      cache = { checkedAt: 0, valid: false };
    },
  };
}
