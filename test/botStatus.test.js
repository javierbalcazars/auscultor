import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readBotStatus, writeBotStatus } from "../src/botStatus.js";

test("guarda el estado con permisos privados", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bot-status-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, "status.json");
  assert.equal(writeBotStatus("qr", { qrDisplay: "QR" }, { filePath, processId: 111 }), true);
  assert.deepEqual(readBotStatus(filePath), {
    state: "qr", processId: 111, updatedAt: readBotStatus(filePath).updatedAt, qrDisplay: "QR",
  });
  assert.equal(fs.statSync(filePath).mode & 0o777, 0o600);
  assert.equal(fs.statSync(directory).mode & 0o777, 0o700);
});

test("un proceso antiguo no sobrescribe el estado de uno nuevo", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bot-status-race-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, "status.json");
  writeBotStatus("connected", {}, { filePath, processId: 222 });
  assert.equal(writeBotStatus("stopped", {}, { filePath, processId: 111, onlyIfCurrentProcess: true }), false);
  assert.equal(readBotStatus(filePath).state, "connected");
  assert.equal(readBotStatus(filePath).processId, 222);
});
