import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { spawnSync } from "node:child_process";

const MAGIC = Buffer.from("WABACK01");
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const BACKUP_PATHS = [".env", "auth_session", "Vault", "data"];

function key(passphrase, salt) {
  if (typeof passphrase !== "string" || passphrase.length < 6) {
    throw new Error("BACKUP_PASSPHRASE debe tener al menos 6 caracteres");
  }
  return crypto.scryptSync(passphrase, salt, 32);
}

function runTar(args, cwd) {
  const result = spawnSync("tar", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr.trim() || "Falló la operación con tar");
  return result.stdout;
}

export async function createEncryptedBackup(projectRoot, destination, passphrase) {
  const available = BACKUP_PATHS.filter((relativePath) => fs.existsSync(path.join(projectRoot, relativePath)));
  if (available.length === 0) throw new Error("No existen datos privados para respaldar");
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "whatsapp-backup-"));
  const tarPath = path.join(temporaryDirectory, "private-data.tar");
  const temporaryOutput = `${destination}.tmp-${process.pid}`;
  try {
    runTar(["-cf", tarPath, ...available], projectRoot);
    const salt = crypto.randomBytes(SALT_BYTES);
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv("aes-256-gcm", key(passphrase, salt), iv);
    fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
    const output = fs.createWriteStream(temporaryOutput, { mode: 0o600 });
    output.write(Buffer.concat([MAGIC, salt, iv]));
    await pipeline(fs.createReadStream(tarPath), cipher, output, { end: false });
    output.end(cipher.getAuthTag());
    await new Promise((resolve, reject) => {
      output.once("close", resolve);
      output.once("error", reject);
    });
    fs.renameSync(temporaryOutput, destination);
    fs.chmodSync(destination, 0o600);
    return { destination, included: available };
  } finally {
    fs.rmSync(temporaryOutput, { force: true });
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

async function decryptBackup(source, destination, passphrase) {
  const size = fs.statSync(source).size;
  const headerBytes = MAGIC.length + SALT_BYTES + IV_BYTES;
  if (size <= headerBytes + TAG_BYTES) throw new Error("El respaldo cifrado está incompleto");
  const descriptor = fs.openSync(source, "r");
  try {
    const header = Buffer.alloc(headerBytes);
    fs.readSync(descriptor, header, 0, header.length, 0);
    if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("Formato de respaldo no reconocido");
    const salt = header.subarray(MAGIC.length, MAGIC.length + SALT_BYTES);
    const iv = header.subarray(MAGIC.length + SALT_BYTES);
    const tag = Buffer.alloc(TAG_BYTES);
    fs.readSync(descriptor, tag, 0, TAG_BYTES, size - TAG_BYTES);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(passphrase, salt), iv);
    decipher.setAuthTag(tag);
    await pipeline(
      fs.createReadStream(source, { start: headerBytes, end: size - TAG_BYTES - 1 }),
      decipher,
      fs.createWriteStream(destination, { mode: 0o600 })
    );
  } catch (error) {
    fs.rmSync(destination, { force: true });
    if (/authenticate data|bad decrypt/i.test(error.message)) throw new Error("Contraseña incorrecta o respaldo dañado");
    throw error;
  } finally {
    fs.closeSync(descriptor);
  }
}

function validateArchive(tarPath, projectRoot) {
  const entries = runTar(["-tf", tarPath], projectRoot).split("\n").filter(Boolean);
  if (entries.length === 0) throw new Error("El respaldo no contiene archivos");
  for (const entry of entries) {
    const normalized = path.posix.normalize(entry);
    const top = normalized.split("/")[0];
    if (normalized.startsWith("/") || normalized.includes("..") || !BACKUP_PATHS.includes(top)) {
      throw new Error(`El respaldo contiene una ruta no permitida: ${entry}`);
    }
  }
  return entries;
}

export async function verifyEncryptedBackup(projectRoot, source, passphrase) {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "whatsapp-verify-"));
  const tarPath = path.join(temporaryDirectory, "private-data.tar");
  try {
    await decryptBackup(source, tarPath, passphrase);
    return validateArchive(tarPath, projectRoot);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

export async function restoreEncryptedBackup(projectRoot, source, passphrase) {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "whatsapp-restore-"));
  const tarPath = path.join(temporaryDirectory, "private-data.tar");
  try {
    await decryptBackup(source, tarPath, passphrase);
    const entries = validateArchive(tarPath, projectRoot);
    runTar(["-xf", tarPath, "--no-same-owner", "--no-same-permissions"], projectRoot);
    return entries;
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}
