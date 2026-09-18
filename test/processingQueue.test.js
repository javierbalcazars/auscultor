import test from "node:test";
import assert from "node:assert/strict";
import { createContactProcessingQueue } from "../src/processingQueue.js";

test("serializa tareas del mismo contacto", async () => {
  const events = [];
  const enqueue = createContactProcessingQueue();
  const first = enqueue("cliente", async () => {
    events.push("inicio-1");
    await new Promise((resolve) => setTimeout(resolve, 5));
    events.push("fin-1");
  });
  const second = enqueue("cliente", async () => events.push("tarea-2"));

  await Promise.all([first, second]);
  assert.deepEqual(events, ["inicio-1", "fin-1", "tarea-2"]);
});
