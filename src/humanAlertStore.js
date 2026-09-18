import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

function validateAlert(payload) {
  if (
    !payload ||
    typeof payload.remoteJid !== "string" ||
    !/^[a-zA-Z0-9_:-]+@(lid|s\.whatsapp\.net)$/.test(payload.remoteJid) ||
    typeof payload.text !== "string" ||
    typeof payload.reason !== "string" ||
    (payload.contactName !== null && typeof payload.contactName !== "string") ||
    typeof payload.createdAt !== "string" ||
    !Number.isFinite(Date.parse(payload.createdAt))
  ) {
    throw new Error("Hay una alerta pendiente con formato inválido; conserva el archivo para revisar el problema");
  }
  return {
    remoteJid: payload.remoteJid,
    contactName: payload.contactName?.slice(0, 30) || null,
    text: payload.text.slice(0, 1500),
    reason: payload.reason.slice(0, 300),
    createdAt: payload.createdAt,
  };
}

export function createHumanAlertStore(filePath) {
  return {
    load() {
      let raw;
      try {
        raw = fs.readFileSync(filePath, "utf8");
      } catch (error) {
        if (error.code === "ENOENT") return [];
        throw error;
      }
      let stored;
      try {
        stored = JSON.parse(raw);
      } catch {
        throw new Error("El archivo de alertas pendientes está dañado; no se sobrescribirá");
      }
      if (stored?.version !== 1 || !Array.isArray(stored.alerts)) {
        throw new Error("El archivo de alertas pendientes tiene un formato no reconocido");
      }
      const alerts = stored.alerts.map(validateAlert);
      fs.chmodSync(path.dirname(filePath), 0o700);
      fs.chmodSync(filePath, 0o600);
      return alerts;
    },
    save(alerts) {
      const data = JSON.stringify({ version: 1, alerts: alerts.map(validateAlert) });
      const directory = path.dirname(filePath);
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
      fs.chmodSync(directory, 0o700);
      const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
      let fd;
      try {
        fd = fs.openSync(temporaryPath, "wx", 0o600);
        fs.writeFileSync(fd, data, "utf8");
        fs.fsyncSync(fd);
        fs.closeSync(fd);
        fd = undefined;
        fs.renameSync(temporaryPath, filePath);
        // Asegurar también la actualización del nombre frente a un corte de luz.
        fd = fs.openSync(directory, "r");
        fs.fsyncSync(fd);
      } finally {
        if (fd !== undefined) fs.closeSync(fd);
        if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
      }
    },
  };
}
