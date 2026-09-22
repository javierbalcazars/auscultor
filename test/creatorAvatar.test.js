import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createCreatorAvatarCache } from "../src/admin/creatorAvatar.js";

test("guarda el avatar, valida su ETag y conserva la copia sin conexión", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "auscultor-avatar-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const expected = Buffer.from("imagen-de-prueba");
  const seenHeaders = [];
  let request = 0;
  const cache = createCreatorAvatarCache({
    directory,
    fetchImpl: async (_url, options) => {
      seenHeaders.push(options.headers);
      request += 1;
      if (request === 1) {
        return new globalThis.Response(expected, { status: 200, headers: { "Content-Type": "image/jpeg", ETag: '"avatar-1"' } });
      }
      if (request === 2) return new globalThis.Response(null, { status: 304 });
      throw new Error("Sin conexión");
    },
  });

  const downloaded = await cache.get();
  assert.deepEqual(downloaded.image, expected);
  assert.equal(downloaded.etag, '"avatar-1"');
  assert.deepEqual(seenHeaders[0], {});

  const unchanged = await cache.get();
  assert.deepEqual(unchanged.image, expected);
  assert.equal(seenHeaders[1]["If-None-Match"], '"avatar-1"');

  const offline = await cache.get();
  assert.deepEqual(offline.image, expected);
  assert.equal(seenHeaders[2]["If-None-Match"], '"avatar-1"');
});

test("ignora respuestas que no son imágenes", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "auscultor-avatar-invalid-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const cache = createCreatorAvatarCache({
    directory,
    fetchImpl: async () => new globalThis.Response("contenido", { status: 200, headers: { "Content-Type": "text/plain" } }),
  });
  assert.equal(await cache.get(), null);
  assert.equal(fs.existsSync(path.join(directory, "avatar.bin")), false);
});
