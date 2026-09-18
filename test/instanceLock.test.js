import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { acquireInstanceLock } from "../src/instanceLock.js";

function temporaryLock(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "whatsapp-bot-lock-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, ".bot-instance.lock");
}

test("impide que dos procesos activos adquieran el mismo candado", (t) => {
  const lockPath = temporaryLock(t);
  const releaseFirst = acquireInstanceLock(lockPath, {
    processId: 101,
    token: "primero",
  });

  assert.throws(
    () => acquireInstanceLock(lockPath, {
      processId: 202,
      token: "segundo",
      isProcessAlive: (processId) => processId === 101,
    }),
    /ya está ejecutándose/
  );

  releaseFirst();
  const releaseSecond = acquireInstanceLock(lockPath, {
    processId: 202,
    token: "segundo",
  });
  releaseSecond();
  assert.equal(fs.existsSync(lockPath), false);
});

test("reemplaza un candado perteneciente a un proceso terminado", (t) => {
  const lockPath = temporaryLock(t);
  fs.writeFileSync(lockPath, JSON.stringify({ processId: 999, token: "obsoleto" }));

  const release = acquireInstanceLock(lockPath, {
    processId: 303,
    token: "actual",
    isProcessAlive: () => false,
  });

  assert.equal(JSON.parse(fs.readFileSync(lockPath, "utf8")).processId, 303);
  release();
});
