import fs from "node:fs";
import path from "node:path";

function readLastMessageAt(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const match = raw.match(/^last_message:\s*(.+)$/m);
  if (!match) return null;
  const timestamp = Date.parse(match[1].trim());
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function inspectConversations(directory, retentionDays, now = Date.now()) {
  if (!fs.existsSync(directory)) return [];
  const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;

  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => {
      const filePath = path.join(directory, entry.name);
      const lastMessageAt = readLastMessageAt(filePath);
      return {
        fileName: entry.name,
        filePath,
        lastMessageAt: lastMessageAt === null ? null : new Date(lastMessageAt).toISOString(),
        expired: lastMessageAt !== null && lastMessageAt < cutoff,
      };
    })
    .sort((left, right) => left.fileName.localeCompare(right.fileName));
}

export function pruneExpiredConversations(directory, retentionDays, {
  apply = false,
  now = Date.now(),
} = {}) {
  const expired = inspectConversations(directory, retentionDays, now)
    .filter((conversation) => conversation.expired);

  if (apply) {
    for (const conversation of expired) {
      fs.unlinkSync(conversation.filePath);
    }
  }

  return expired;
}

export function deleteConversationFile(filePath, { apply = false } = {}) {
  if (!fs.existsSync(filePath)) return false;
  if (!fs.statSync(filePath).isFile() || path.extname(filePath).toLowerCase() !== ".md") {
    throw new Error("Solo se puede eliminar un archivo Markdown de conversación");
  }
  if (apply) fs.unlinkSync(filePath);
  return true;
}
