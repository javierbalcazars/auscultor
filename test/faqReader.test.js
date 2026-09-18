import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { buildFaqContext, loadFaqDocuments } from "../src/faqReader.js";

test("carga todas las FAQs y excluye los chats privados", (t) => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "whatsapp-bot-vault-"));
  t.after(() => fs.rmSync(vault, { recursive: true, force: true }));
  fs.mkdirSync(path.join(vault, "FAQs"));
  fs.mkdirSync(path.join(vault, "Chats"));
  fs.writeFileSync(
    path.join(vault, "FAQs", "Información.md"),
    "# Información\nEl supermercado está a 10 minutos."
  );
  fs.writeFileSync(
    path.join(vault, "FAQs", "Políticas.md"),
    "# Políticas\nLas cancelaciones están sujetas a condiciones."
  );
  fs.writeFileSync(
    path.join(vault, "Chats", "privado.md"),
    "Este contenido privado nunca debe llegar al modelo."
  );

  const notes = loadFaqDocuments(vault, ["Chats"]);
  const context = buildFaqContext(notes);

  assert.equal(notes.length, 2);
  assert.match(context, /supermercado/);
  assert.match(context, /cancelaciones/);
  assert.doesNotMatch(context, /contenido privado/);
});

test("devuelve contexto vacío cuando no existen FAQs", () => {
  assert.equal(buildFaqContext([]), "");
});
