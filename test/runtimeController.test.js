import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createRuntimeController } from "../src/runtimeController.js";

test("instala señales y libera recursos al detenerse", () => {
  const fakeProcess = new EventEmitter();
  fakeProcess.exit = (code) => { fakeProcess.exitCode = code; };
  let released = 0;
  const statuses = [];
  const runtime = createRuntimeController({
    connect: async () => {},
    processRef: fakeProcess,
    writeStatus: (...args) => statuses.push(args),
  });
  runtime.setReleaseLock(() => { released += 1; });
  runtime.installProcessHandlers();
  fakeProcess.emit("SIGTERM");
  assert.equal(released, 1);
  assert.equal(fakeProcess.exitCode, 0);
  assert.equal(statuses.at(-1)[0], "stopped");
});
