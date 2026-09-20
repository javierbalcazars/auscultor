import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { initializeUserData } from "../src/initializeUserData.js";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "auscultor-data-"));
  const projectRoot = path.join(root, "app");
  fs.mkdirSync(path.join(projectRoot, "packaging/default-data/Vault/FAQs"), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, "packaging/default-data/Vault/FAQs/Información.md"), "# Plantilla\n");
  return { root, projectRoot, dataRoot: path.join(root, "profile") };
}

test("inicializa datos persistentes y copia una FAQ genérica", () => {
  const value = fixture();
  try {
    initializeUserData(value);
    assert.equal(fs.readFileSync(path.join(value.dataRoot, "Vault/FAQs/Información.md"), "utf8"), "# Plantilla\n");
    assert.ok(fs.statSync(path.join(value.dataRoot, "Vault/Chats")).isDirectory());
    assert.ok(fs.statSync(path.join(value.dataRoot, "data")).isDirectory());
  } finally { fs.rmSync(value.root, { recursive: true, force: true }); }
});

test("no reemplaza las FAQs existentes", () => {
  const value = fixture();
  try {
    fs.mkdirSync(path.join(value.dataRoot, "Vault/FAQs"), { recursive: true });
    fs.writeFileSync(path.join(value.dataRoot, "Vault/FAQs/Propia.md"), "# Propia\n");
    initializeUserData(value);
    assert.deepEqual(fs.readdirSync(path.join(value.dataRoot, "Vault/FAQs")), ["Propia.md"]);
  } finally { fs.rmSync(value.root, { recursive: true, force: true }); }
});
