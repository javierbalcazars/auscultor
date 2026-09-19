import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "../src/config.js";
import {
  createEncryptedBackup,
  restoreEncryptedBackup,
  verifyEncryptedBackup,
} from "../src/encryptedBackup.js";

const [command, target, confirmation] = process.argv.slice(2);
const passphrase = process.env.BACKUP_PASSPHRASE;
if (!command || !target || !["create", "verify", "restore"].includes(command)) {
  console.error("Uso: npm run backup -- create|verify|restore RUTA [--apply]");
  process.exit(1);
}
if (!passphrase) {
  console.error("Define BACKUP_PASSPHRASE con una contraseña de al menos 12 caracteres.");
  process.exit(1);
}

const targetPath = path.resolve(target);
if (command === "create") {
  if (fs.existsSync(targetPath)) throw new Error(`El destino ya existe: ${targetPath}`);
  const result = await createEncryptedBackup(PROJECT_ROOT, targetPath, passphrase);
  console.log(`Respaldo cifrado creado: ${result.destination}`);
  console.log(`Incluye: ${result.included.join(", ")}`);
} else if (command === "verify") {
  const entries = await verifyEncryptedBackup(PROJECT_ROOT, targetPath, passphrase);
  console.log(`Respaldo válido: ${entries.length} entrada(s).`);
} else {
  if (confirmation !== "--apply") throw new Error("La restauración requiere confirmar con --apply");
  const rollback = `${targetPath}.antes-de-restaurar-${new Date().toISOString().replace(/[:.]/g, "-")}.wbackup`;
  await createEncryptedBackup(PROJECT_ROOT, rollback, passphrase);
  const entries = await restoreEncryptedBackup(PROJECT_ROOT, targetPath, passphrase);
  console.log(`Restauración completada: ${entries.length} entrada(s).`);
  console.log(`Respaldo previo de seguridad: ${rollback}`);
}
