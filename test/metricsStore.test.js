import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createMetricsStore } from "../src/metricsStore.js";

test("acumula contadores y duraciones sin guardar contactos", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bot-metrics-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, "metrics.json");
  const store = createMetricsStore(filePath);
  store.increment("messages_received");
  store.increment("messages_received", 2);
  store.duration("llm_request", 100);
  store.duration("llm_request", 300);
  const metrics = store.read();
  assert.equal(metrics.counters.messages_received, 3);
  assert.deepEqual(metrics.durations.llm_request, { count: 2, totalMs: 400, maxMs: 300, averageMs: 200 });
  assert.equal(fs.statSync(filePath).mode & 0o777, 0o600);
  assert.doesNotMatch(fs.readFileSync(filePath, "utf8"), /contact|jid|phone/i);
});
