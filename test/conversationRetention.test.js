import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  deleteConversationFile,
  inspectConversations,
  pruneExpiredConversations,
} from "../src/conversationRetention.js";

function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "auscultor-retention-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function writeConversation(directory, name, date) {
  fs.writeFileSync(path.join(directory, name), `---\nlast_message: ${date}\n---\n`, { mode: 0o600 });
}

test("identifica chats fuera de la retención sin eliminarlos", (t) => {
  const directory = temporaryDirectory(t);
  writeConversation(directory, "antiguo.md", "2025-01-01T00:00:00.000Z");
  writeConversation(directory, "reciente.md", "2026-09-10T00:00:00.000Z");
  const now = Date.parse("2026-09-18T00:00:00.000Z");

  const inspected = inspectConversations(directory, 180, now);
  assert.equal(inspected.find((item) => item.fileName === "antiguo.md").expired, true);
  assert.equal(inspected.find((item) => item.fileName === "reciente.md").expired, false);
  assert.equal(pruneExpiredConversations(directory, 180, { now }).length, 1);
  assert.equal(fs.existsSync(path.join(directory, "antiguo.md")), true);
});

test("solo elimina chats cuando se confirma con apply", (t) => {
  const directory = temporaryDirectory(t);
  const filePath = path.join(directory, "cliente.md");
  writeConversation(directory, "cliente.md", "2025-01-01T00:00:00.000Z");

  assert.equal(deleteConversationFile(filePath), true);
  assert.equal(fs.existsSync(filePath), true);
  assert.equal(deleteConversationFile(filePath, { apply: true }), true);
  assert.equal(fs.existsSync(filePath), false);
});
