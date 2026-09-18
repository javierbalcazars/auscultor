import fs from "fs";
import { randomUUID } from "crypto";

function processIsAlive(processId) {
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

/**
 * Crea un candado atómico para que dos procesos no compartan auth_session.
 * Un candado de un proceso que ya terminó se reemplaza automáticamente.
 */
export function acquireInstanceLock(
  lockPath,
  {
    processId = process.pid,
    isProcessAlive = processIsAlive,
    token = `${processId}-${Date.now()}-${randomUUID()}`,
  } = {}
) {
  const lockData = JSON.stringify({ processId, token, startedAt: new Date().toISOString() });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      fs.writeFileSync(lockPath, lockData, { encoding: "utf8", flag: "wx", mode: 0o600 });
      let released = false;
      return () => {
        if (released) return;
        released = true;
        try {
          if (fs.readFileSync(lockPath, "utf8") === lockData) fs.unlinkSync(lockPath);
        } catch (error) {
          if (error?.code !== "ENOENT") throw error;
        }
      };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;

      let storedProcessId = null;
      try {
        const stored = JSON.parse(fs.readFileSync(lockPath, "utf8"));
        storedProcessId = Number(stored.processId);
      } catch {
        // Un archivo incompleto se considera obsoleto.
      }

      if (Number.isInteger(storedProcessId) && storedProcessId > 0 && isProcessAlive(storedProcessId)) {
        throw new Error(`El bot ya está ejecutándose en el proceso ${storedProcessId}`);
      }

      try {
        fs.unlinkSync(lockPath);
      } catch (unlinkError) {
        if (unlinkError?.code !== "ENOENT") throw unlinkError;
      }
    }
  }

  throw new Error("No se pudo crear el candado de instancia del bot");
}
