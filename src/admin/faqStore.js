import fs from "node:fs";
import path from "node:path";
import { DATA_ROOT, resolveProjectPath } from "../config.js";
import { readAdminConfig } from "./configStore.js";

const MAX_NAME_LENGTH = 100;
const MAX_CONTENT_LENGTH = 200_000;

function faqDirectory() {
  return path.join(resolveProjectPath(readAdminConfig().VAULT_PATH || "./Vault"), "FAQs");
}

function validName(value) {
  const name = String(value || "").normalize("NFC").trim();
  if (!name.toLowerCase().endsWith(".md")) throw new Error("El documento debe terminar en .md");
  if (name.length < 4 || name.length > MAX_NAME_LENGTH || name.startsWith(".") || /[\\/\0\r\n]/.test(name)) {
    throw new Error("El nombre del documento no es válido");
  }
  return name;
}

function documentPath(directory, name) {
  const safeName = validName(name);
  const target = path.join(directory, safeName);
  if (path.dirname(target) !== directory) throw new Error("Ruta de FAQ rechazada");
  return target;
}

function ensureRegularFile(target) {
  if (!fs.existsSync(target)) return;
  const stat = fs.lstatSync(target);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("El documento de FAQ no es un archivo normal");
}

function backup(target, backupRoot = path.join(DATA_ROOT, ".local", "faq-backups")) {
  if (!fs.existsSync(target)) return null;
  fs.mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const destination = path.join(backupRoot, `${stamp}-${path.basename(target)}`);
  fs.copyFileSync(target, destination);
  fs.chmodSync(destination, 0o600);
  return destination;
}

export function listFaqs(directory = faqDirectory()) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.isSymbolicLink() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => {
      const target = documentPath(directory, entry.name);
      const stat = fs.statSync(target);
      return { name: entry.name, content: fs.readFileSync(target, "utf8"), updatedAt: stat.mtime.toISOString() };
    })
    .sort((left, right) => left.name.localeCompare(right.name, "es"));
}

export function saveFaq({ originalName, name, content }, directory = faqDirectory(), backupRoot) {
  const safeName = validName(name);
  const text = String(content ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) throw new Error("La FAQ no puede quedar vacía");
  if (text.length > MAX_CONTENT_LENGTH) throw new Error("La FAQ supera el máximo de 200.000 caracteres");
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const target = documentPath(directory, safeName);
  const previous = originalName ? documentPath(directory, originalName) : target;
  ensureRegularFile(previous);
  if (previous !== target && fs.existsSync(target)) throw new Error("Ya existe una FAQ con ese nombre");
  backup(previous, backupRoot);
  const temporary = `${target}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${text}\n`, { mode: 0o600 });
  fs.renameSync(temporary, target);
  fs.chmodSync(target, 0o600);
  if (previous !== target && fs.existsSync(previous)) fs.unlinkSync(previous);
  return { name: safeName, content: `${text}\n` };
}

export function deleteFaq(name, directory = faqDirectory(), backupRoot) {
  const target = documentPath(directory, name);
  ensureRegularFile(target);
  if (!fs.existsSync(target)) throw new Error("La FAQ ya no existe");
  if (listFaqs(directory).length <= 1) throw new Error("Debe existir al menos una FAQ");
  backup(target, backupRoot);
  fs.unlinkSync(target);
}

export const FAQ_TEMPLATES = [
  { name: "Información general.md", content: "# Información general\n\n## Nombre y descripción\n[Completar]\n\n## Contacto\n[Completar]\n" },
  { name: "Horarios y ubicación.md", content: "# Horarios y ubicación\n\n## Horarios de atención\n[Completar]\n\n## Dirección y cómo llegar\n[Completar]\n" },
  { name: "Tarifas y reservas.md", content: "# Tarifas y reservas\n\n## Tarifas confirmadas\n[Completar]\n\n## Formas de reserva y pago\n[Completar]\n" },
  { name: "Servicios y políticas.md", content: "# Servicios y políticas\n\n## Servicios incluidos\n[Completar]\n\n## Mascotas, cancelaciones y reglas\n[Completar]\n" },
];
