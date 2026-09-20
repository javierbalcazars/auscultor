import fs from "node:fs";
import path from "node:path";
import { AUTH_SESSION_PATH, DATA_ROOT, ENV_PATH, FAQS_PATH, METRICS_PATH, VAULT_PATH, loadRuntimeConfig } from "../config.js";
import { createEncryptedBackup, restoreEncryptedBackup, verifyEncryptedBackup } from "../encryptedBackup.js";
import { createMetricsStore } from "../metricsStore.js";

const BACKUP_DIRECTORY = path.join(DATA_ROOT, ".local", "encrypted-backups");

function modeOf(target) {
  return fs.existsSync(target) ? (fs.statSync(target).mode & 0o777).toString(8).padStart(3, "0") : "ausente";
}

function backupPath(name) {
  const safeName = path.basename(String(name || ""));
  if (!safeName.endsWith(".wbackup") || safeName !== name) throw new Error("Nombre de respaldo no válido");
  return path.join(BACKUP_DIRECTORY, safeName);
}

function listBackups() {
  if (!fs.existsSync(BACKUP_DIRECTORY)) return [];
  return fs.readdirSync(BACKUP_DIRECTORY, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".wbackup"))
    .map((entry) => {
      const stat = fs.statSync(path.join(BACKUP_DIRECTORY, entry.name));
      return { name: entry.name, size: stat.size, updatedAt: stat.mtime.toISOString() };
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function readAdminTools() {
  const checks = [];
  try {
    const config = loadRuntimeConfig();
    checks.push({ name: "Configuración", ok: true, detail: `${config.humanSupportJids.length} encargado(s)` });
  } catch (error) {
    checks.push({ name: "Configuración", ok: false, detail: error.message });
  }
  checks.push({ name: ".env", ok: fs.existsSync(ENV_PATH), detail: `permisos ${modeOf(ENV_PATH)}` });
  checks.push({ name: "Vault", ok: fs.existsSync(VAULT_PATH), detail: VAULT_PATH });
  const faqCount = fs.existsSync(FAQS_PATH) ? fs.readdirSync(FAQS_PATH).filter((name) => name.toLowerCase().endsWith(".md")).length : 0;
  checks.push({ name: "FAQs", ok: faqCount > 0, detail: `${faqCount} documento(s)` });
  checks.push({ name: "WhatsApp", ok: fs.existsSync(path.join(AUTH_SESSION_PATH, "creds.json")), detail: fs.existsSync(AUTH_SESSION_PATH) ? `permisos ${modeOf(AUTH_SESSION_PATH)}` : "sin sesión" });
  return { checks, metrics: createMetricsStore(METRICS_PATH).read(), backups: listBackups() };
}

export async function createAdminBackup(passphrase) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const destination = path.join(BACKUP_DIRECTORY, `Auscultor-${stamp}.wbackup`);
  return createEncryptedBackup(DATA_ROOT, destination, String(passphrase || ""));
}

export async function restoreAdminBackup(name, passphrase, confirmed) {
  if (confirmed !== true) throw new Error("La restauración requiere confirmación");
  const source = backupPath(name);
  if (!fs.existsSync(source)) throw new Error("El respaldo seleccionado no existe");
  await verifyEncryptedBackup(DATA_ROOT, source, String(passphrase || ""));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const rollback = path.join(BACKUP_DIRECTORY, `Antes-de-restaurar-${stamp}.wbackup`);
  await createEncryptedBackup(DATA_ROOT, rollback, String(passphrase || ""));
  const entries = await restoreEncryptedBackup(DATA_ROOT, source, String(passphrase || ""));
  return { entries, rollback: path.basename(rollback) };
}
