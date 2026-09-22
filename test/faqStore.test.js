import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { deleteFaq, listFaqs, saveFaq } from "../src/admin/faqStore.js";

test("administra FAQs dentro de una carpeta aislada y crea respaldos", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "auscultor-faq-admin-"));
  const directory = path.join(root, "FAQs");
  const backups = path.join(root, "backups");
  fs.mkdirSync(directory);
  fs.writeFileSync(path.join(directory, "General.md"), "# General\n");
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  saveFaq({ originalName: "General.md", name: "Datos.md", content: "# Datos" }, directory, backups);
  assert.deepEqual(listFaqs(directory).map((item) => item.name), ["Datos.md"]);
  assert.equal(fs.readdirSync(backups).length, 1);
  assert.throws(() => saveFaq({ name: "../secreto.md", content: "x" }, directory, backups), /nombre|Ruta/);
  assert.throws(() => saveFaq({ name: "Vacía.md", content: "  " }, directory, backups), /vacía/);
  assert.throws(
    () => saveFaq({ name: "Pendiente.md", content: "# Pendiente\n[Escribe el teléfono]" }, directory, backups),
    /campos pendientes/,
  );

  saveFaq({ name: "Otra.md", content: "# Otra" }, directory, backups);
  deleteFaq("Otra.md", directory, backups);
  assert.throws(() => deleteFaq("Datos.md", directory, backups), /al menos una/);
});
