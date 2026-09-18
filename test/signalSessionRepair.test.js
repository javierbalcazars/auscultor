import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import {
  extractSignalSessionAddress,
  MAX_SIGNAL_REPAIR_QUARANTINES,
  pruneSignalRepairQuarantines,
  quarantineSignalSessions,
} from "../src/signalSessionRepair.js";

test("extrae únicamente una dirección de sesión válida desde la traza de libsignal", () => {
  const trace = "Session error: Bad MAC\n    at async 28475767398580.64 [as awaitable]";
  assert.equal(extractSignalSessionAddress(trace), "28475767398580.64");
  assert.equal(extractSignalSessionAddress("Session error: Bad MAC"), null);
});

test("pone en cuarentena solo los archivos de la sesión dañada", (t) => {
  const authDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "whatsapp-session-repair-"));
  t.after(() => fs.rmSync(authDirectory, { recursive: true, force: true }));

  const damagedFiles = [
    "session-28475767398580.64.json",
    "sender-key-120363168169665897@g.us--28475767398580--64.json",
  ];
  const preservedFiles = ["creds.json", "session-11111111111.0.json"];
  for (const fileName of [...damagedFiles, ...preservedFiles]) {
    fs.writeFileSync(path.join(authDirectory, fileName), "{}", { mode: 0o600 });
  }

  const result = quarantineSignalSessions(authDirectory, ["28475767398580.64"], {
    now: () => new Date("2026-08-25T21:00:00.000Z"),
  });

  assert.deepEqual(result.movedFiles.sort(), damagedFiles.sort());
  assert.deepEqual(result.repairedAddresses, ["28475767398580.64"]);
  assert.ok(result.quarantineDirectory);
  for (const fileName of damagedFiles) {
    assert.equal(fs.existsSync(path.join(authDirectory, fileName)), false);
    assert.equal(fs.existsSync(path.join(result.quarantineDirectory, fileName)), true);
  }
  for (const fileName of preservedFiles) {
    assert.equal(fs.existsSync(path.join(authDirectory, fileName)), true);
  }
});

test("ignora direcciones inválidas y no crea cuarentena", (t) => {
  const authDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "whatsapp-session-repair-"));
  t.after(() => fs.rmSync(authDirectory, { recursive: true, force: true }));
  fs.writeFileSync(path.join(authDirectory, "creds.json"), "{}", { mode: 0o600 });

  const result = quarantineSignalSessions(authDirectory, ["../../creds", "texto"]);

  assert.deepEqual(result.movedFiles, []);
  assert.equal(result.quarantineDirectory, null);
  assert.equal(fs.existsSync(path.join(authDirectory, "creds.json")), true);
});

test("conserva como máximo las cuatro reparaciones más recientes", (t) => {
  const authDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "whatsapp-session-repair-"));
  t.after(() => fs.rmSync(authDirectory, { recursive: true, force: true }));
  const quarantineRoot = path.join(authDirectory, ".session-repair-quarantine");
  const repairs = [
    "2026-08-21T10-00-00-000Z-101",
    "2026-08-22T10-00-00-000Z-102",
    "2026-08-23T10-00-00-000Z-103",
    "2026-08-24T10-00-00-000Z-104",
    "2026-08-25T10-00-00-000Z-105",
  ];
  for (const repair of repairs) {
    const repairDirectory = path.join(quarantineRoot, repair);
    fs.mkdirSync(repairDirectory, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(repairDirectory, "session.json"), "{}", { mode: 0o600 });
  }

  const removed = pruneSignalRepairQuarantines(authDirectory);
  const remaining = fs.readdirSync(quarantineRoot).sort();

  assert.equal(MAX_SIGNAL_REPAIR_QUARANTINES, 4);
  assert.deepEqual(removed, [repairs[0]]);
  assert.deepEqual(remaining, repairs.slice(1));
});
