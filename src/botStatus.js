import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "./config.js";

export const BOT_STATUS_PATH = path.join(PROJECT_ROOT, ".local", "bot-status.json");

export function writeBotStatus(state, details = {}, {
  onlyIfCurrentProcess = false,
  filePath = BOT_STATUS_PATH,
  processId = process.pid,
} = {}) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.chmodSync(path.dirname(filePath), 0o700);
  if (onlyIfCurrentProcess) {
    const current = readBotStatus(filePath);
    if (current?.processId && current.processId !== processId) return false;
  }
  const temporary = `${filePath}.tmp-${processId}`;
  fs.writeFileSync(temporary, JSON.stringify({ state, processId, updatedAt: new Date().toISOString(), ...details }), { mode: 0o600 });
  fs.renameSync(temporary, filePath);
  fs.chmodSync(filePath, 0o600);
  return true;
}

export function readBotStatus(filePath = BOT_STATUS_PATH) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}
