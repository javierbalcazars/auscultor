import fs from "node:fs";
import path from "node:path";
import { DATA_ROOT, resolveProjectPath } from "../config.js";
import { readAdminConfig } from "./configStore.js";

const MAX_NAME_LENGTH = 100;
const MAX_CONTENT_LENGTH = 200_000;
const PENDING_TEMPLATE_FIELD = /\[(?:Completar|Escribe|Indica|Describe|Agrega|Aclara)[^\]]*\]/iu;

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
  if (PENDING_TEMPLATE_FIELD.test(text)) {
    throw new Error("Completa o elimina todos los campos pendientes de la plantilla");
  }
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
  { name: "Información principal.md", content: "# Información principal\n\n## Nombre del alojamiento\n[Escribe el nombre comercial completo]\n\n## Tipo y descripción\n[Indica si es hotel, hostal, camping, cabaña u otro tipo de alojamiento y descríbelo brevemente]\n\n## Contacto para consultas y reservas\n[Agrega el teléfono, correo o canal oficial que pueden usar los clientes]\n" },
  { name: "Ubicación y horarios.md", content: "# Ubicación y horarios\n\n## Dirección\n[Escribe la dirección o ubicación confirmada]\n\n## Cómo llegar\n[Describe indicaciones útiles, accesos o referencias]\n\n## Llegada y salida\n[Indica los horarios de check-in y check-out]\n\n## Horario de atención\n[Indica cuándo se responden consultas]\n" },
  { name: "Tarifas y reservas.md", content: "# Tarifas y reservas\n\n## Tarifas\n[Indica los precios confirmados o de qué factores dependen]\n\n## Qué incluye la tarifa\n[Describe los servicios incluidos y los cobros adicionales]\n\n## Cómo reservar\n[Describe el proceso y los datos necesarios para confirmar una reserva]\n\n## Formas de pago\n[Indica los medios de pago aceptados]\n\n## Cambios y cancelaciones\n[Aclara las condiciones confirmadas]\n" },
  { name: "Servicios y normas.md", content: "# Servicios y normas\n\n## Servicios disponibles\n[Describe alojamiento, alimentación, estacionamiento, wifi u otros servicios confirmados]\n\n## Normas del lugar\n[Indica las reglas que deben conocer los huéspedes]\n\n## Mascotas y restricciones\n[Aclara si se aceptan mascotas y cualquier restricción relevante]\n\n## Accesibilidad y necesidades especiales\n[Indica la información confirmada o elimina esta sección si no corresponde]\n" },
];
