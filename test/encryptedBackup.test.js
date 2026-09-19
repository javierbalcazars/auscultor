import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createEncryptedBackup,
  restoreEncryptedBackup,
  verifyEncryptedBackup,
} from "../src/encryptedBackup.js";

test("crea, verifica y restaura un respaldo cifrado", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bot-backup-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, "Vault", "FAQs"), { recursive: true });
  fs.writeFileSync(path.join(directory, ".env"), "OPENAI_API_KEY=secreto\n", { mode: 0o600 });
  fs.writeFileSync(path.join(directory, "Vault", "FAQs", "Información.md"), "contenido privado");
  const destination = path.join(directory, "backup.wbackup");
  const passphrase = "contraseña-de-prueba-segura";
  await createEncryptedBackup(directory, destination, passphrase);
  assert.equal(fs.statSync(destination).mode & 0o777, 0o600);
  assert.doesNotMatch(fs.readFileSync(destination).toString("latin1"), /secreto|contenido privado/);
  const entries = await verifyEncryptedBackup(directory, destination, passphrase);
  assert.ok(entries.includes(".env"));
  fs.writeFileSync(path.join(directory, ".env"), "modificado");
  await restoreEncryptedBackup(directory, destination, passphrase);
  assert.equal(fs.readFileSync(path.join(directory, ".env"), "utf8"), "OPENAI_API_KEY=secreto\n");
  await assert.rejects(verifyEncryptedBackup(directory, destination, "contraseña-incorrecta"), /incorrecta|dañado/);
});
