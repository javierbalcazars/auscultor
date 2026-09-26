import fs from "node:fs";
import path from "node:path";
import { DATA_ROOT } from "../config.js";

const PROMPT_PATH = path.join(DATA_ROOT, ".local", "custom-prompt.md");
const BACKUP_DIR = path.join(DATA_ROOT, ".local", "prompt-backups");
const MAX_PROMPT_LENGTH = 20_000;
export function readCustomPrompt() {
  if (!fs.existsSync(PROMPT_PATH)) return "";
  return fs.readFileSync(PROMPT_PATH, "utf8").trim();
}

export function saveCustomPrompt(value) {
  const content = String(value ?? "").trim();
  if (content.length > MAX_PROMPT_LENGTH) throw new Error(`El prompt no puede superar ${MAX_PROMPT_LENGTH} caracteres`);
  fs.mkdirSync(path.dirname(PROMPT_PATH), { recursive: true, mode: 0o700 });
  fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
  if (fs.existsSync(PROMPT_PATH)) {
    const backup = path.join(BACKUP_DIR, `prompt-${new Date().toISOString().replace(/[:.]/g, "-")}.md`);
    fs.copyFileSync(PROMPT_PATH, backup);
    fs.chmodSync(backup, 0o600);
  }
  const temporary = `${PROMPT_PATH}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, content ? `${content}\n` : "", { mode: 0o600 });
  fs.renameSync(temporary, PROMPT_PATH);
  fs.chmodSync(PROMPT_PATH, 0o600);
  return content;
}

export { MAX_PROMPT_LENGTH };
