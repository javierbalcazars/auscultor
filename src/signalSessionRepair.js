import fs from "fs";
import path from "path";

const SESSION_ADDRESS_PATTERN = /\b(\d{5,20})\.(\d{1,3})\s+\[as awaitable\]/;
const REPAIR_DIRECTORY_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-\d+$/;
export const MAX_SIGNAL_REPAIR_QUARANTINES = 4;

export function extractSignalSessionAddress(logText) {
  if (typeof logText !== "string") return null;
  const match = logText.match(SESSION_ADDRESS_PATTERN);
  return match ? `${match[1]}.${match[2]}` : null;
}

function parseSessionAddress(address) {
  if (typeof address !== "string") return null;
  const match = address.match(/^(\d{5,20})\.(\d{1,3})$/);
  return match ? { user: match[1], device: match[2], address } : null;
}

function quarantineFolderName(now) {
  return now.toISOString().replace(/[:.]/g, "-");
}

export function pruneSignalRepairQuarantines(
  authDirectory,
  maximumRepairs = MAX_SIGNAL_REPAIR_QUARANTINES
) {
  if (!Number.isInteger(maximumRepairs) || maximumRepairs < 1) {
    throw new Error("El máximo de cuarentenas debe ser un entero mayor o igual a 1");
  }

  const quarantineRoot = path.join(authDirectory, ".session-repair-quarantine");
  if (!fs.existsSync(quarantineRoot)) return [];

  const repairDirectories = fs
    .readdirSync(quarantineRoot, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && REPAIR_DIRECTORY_PATTERN.test(entry.name)
    )
    .map((entry) => entry.name)
    .sort();
  const directoriesToRemove = repairDirectories.slice(
    0,
    Math.max(0, repairDirectories.length - maximumRepairs)
  );

  for (const directoryName of directoriesToRemove) {
    fs.rmSync(path.join(quarantineRoot, directoryName), {
      recursive: true,
      force: false,
    });
  }

  return directoriesToRemove;
}

/**
 * Aparta solamente las sesiones cifradas asociadas al dispositivo que falló.
 * Baileys generará claves nuevas al volver a conectarse. Los archivos se mueven
 * a una cuarentena privada para que la reparación sea reversible.
 */
export function quarantineSignalSessions(authDirectory, addresses, { now = () => new Date() } = {}) {
  const parsedAddresses = [...new Set(addresses)]
    .map(parseSessionAddress)
    .filter(Boolean);

  if (parsedAddresses.length === 0 || !fs.existsSync(authDirectory)) {
    return {
      movedFiles: [],
      repairedAddresses: [],
      quarantineDirectory: null,
      removedQuarantines: [],
    };
  }

  const entries = fs
    .readdirSync(authDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
  const matchedByAddress = new Map(parsedAddresses.map(({ address }) => [address, []]));

  for (const fileName of entries) {
    for (const { user, device, address } of parsedAddresses) {
      const directSession = fileName === `session-${address}.json`;
      const groupSenderSession =
        fileName.startsWith("sender-key-") &&
        fileName.endsWith(`--${user}--${device}.json`);
      if (directSession || groupSenderSession) {
        matchedByAddress.get(address).push(fileName);
      }
    }
  }

  const filesToMove = [...new Set([...matchedByAddress.values()].flat())];
  if (filesToMove.length === 0) {
    return {
      movedFiles: [],
      repairedAddresses: [],
      quarantineDirectory: null,
      removedQuarantines: [],
    };
  }

  const quarantineDirectory = path.join(
    authDirectory,
    ".session-repair-quarantine",
    `${quarantineFolderName(now())}-${process.pid}`
  );
  fs.mkdirSync(quarantineDirectory, { recursive: true, mode: 0o700 });
  fs.chmodSync(path.dirname(quarantineDirectory), 0o700);
  fs.chmodSync(quarantineDirectory, 0o700);

  for (const fileName of filesToMove) {
    const source = path.join(authDirectory, fileName);
    const destination = path.join(quarantineDirectory, fileName);
    fs.renameSync(source, destination);
    fs.chmodSync(destination, 0o600);
  }

  const repairedAddresses = [...matchedByAddress]
    .filter(([, files]) => files.length > 0)
    .map(([address]) => address);

  const removedQuarantines = pruneSignalRepairQuarantines(authDirectory);

  return {
    movedFiles: filesToMove,
    repairedAddresses,
    quarantineDirectory,
    removedQuarantines,
  };
}
