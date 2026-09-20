import fs from "node:fs";
import { pathToFileURL } from "node:url";

function readExactly(fd, length, position) {
  const buffer = Buffer.alloc(length);
  const bytesRead = fs.readSync(fd, buffer, 0, length, position);
  if (bytesRead !== length) throw new Error("AppImage truncada o estructura ELF inválida.");
  return buffer;
}

function safeNumber(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`${label} ELF inválido.`);
  return number;
}

function findSection(filePath, sectionName) {
  const fd = fs.openSync(filePath, "r");
  try {
    const header = readExactly(fd, 64, 0);
    if (header.subarray(0, 4).toString("hex") !== "7f454c46") throw new Error("El archivo no es un ELF válido.");
    if (header[4] !== 2 || header[5] !== 1) throw new Error("Solo se admiten AppImages ELF64 little-endian.");

    const sectionTableOffset = safeNumber(header.readBigUInt64LE(40), "Offset de secciones");
    const sectionEntrySize = header.readUInt16LE(58);
    const sectionCount = header.readUInt16LE(60);
    const namesIndex = header.readUInt16LE(62);
    if (sectionEntrySize < 64 || sectionCount === 0 || namesIndex >= sectionCount) {
      throw new Error("Tabla de secciones ELF inválida.");
    }

    const table = readExactly(fd, sectionEntrySize * sectionCount, sectionTableOffset);
    const sectionHeader = (index) => table.subarray(index * sectionEntrySize, (index + 1) * sectionEntrySize);
    const namesHeader = sectionHeader(namesIndex);
    const namesOffset = safeNumber(namesHeader.readBigUInt64LE(24), "Offset de nombres");
    const namesSize = safeNumber(namesHeader.readBigUInt64LE(32), "Tamaño de nombres");
    const names = readExactly(fd, namesSize, namesOffset);

    for (let index = 0; index < sectionCount; index += 1) {
      const entry = sectionHeader(index);
      const nameOffset = entry.readUInt32LE(0);
      if (nameOffset >= names.length) continue;
      const end = names.indexOf(0, nameOffset);
      const name = names.subarray(nameOffset, end === -1 ? names.length : end).toString("utf8");
      if (name === sectionName) {
        return {
          offset: safeNumber(entry.readBigUInt64LE(24), `Offset de ${sectionName}`),
          size: safeNumber(entry.readBigUInt64LE(32), `Tamaño de ${sectionName}`),
        };
      }
    }
    throw new Error(`La sección ${sectionName} no existe en la AppImage.`);
  } finally {
    fs.closeSync(fd);
  }
}

export function readAppImageUpdateInfo(filePath) {
  const section = findSection(filePath, ".upd_info");
  const fd = fs.openSync(filePath, "r");
  try {
    const raw = readExactly(fd, section.size, section.offset);
    const end = raw.indexOf(0);
    return raw.subarray(0, end === -1 ? raw.length : end).toString("utf8");
  } finally {
    fs.closeSync(fd);
  }
}

export function embedAppImageUpdateInfo(filePath, updateInfo) {
  if (!updateInfo || updateInfo.includes("\0") || /[\r\n]/u.test(updateInfo)) {
    throw new Error("La información de actualización no es válida.");
  }
  const encoded = Buffer.from(updateInfo, "utf8");
  const section = findSection(filePath, ".upd_info");
  if (encoded.length + 1 > section.size) throw new Error("La información no cabe en la sección .upd_info.");

  const payload = Buffer.alloc(section.size);
  encoded.copy(payload);
  const fd = fs.openSync(filePath, "r+");
  try {
    const written = fs.writeSync(fd, payload, 0, payload.length, section.offset);
    if (written !== payload.length) throw new Error("No se pudo escribir toda la información de actualización.");
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  if (readAppImageUpdateInfo(filePath) !== updateInfo) throw new Error("Falló la verificación de .upd_info.");
}

function runCli() {
  const [command, filePath, expected] = process.argv.slice(2);
  if (!filePath || !["embed", "verify", "print"].includes(command)) {
    throw new Error("Uso: node scripts/appimage-update-info.js <embed|verify|print> <AppImage> [información]");
  }
  if (command === "embed") embedAppImageUpdateInfo(filePath, expected);
  const actual = readAppImageUpdateInfo(filePath);
  if (command === "verify" && actual !== expected) {
    throw new Error(`Información inesperada en .upd_info: ${JSON.stringify(actual)}`);
  }
  process.stdout.write(`${actual}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
