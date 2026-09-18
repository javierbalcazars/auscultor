import fs from "fs";
import path from "path";

const EMOJI_REGEX =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\uFE0F]/gu;
const HISTORY_START_MARKER = "<!-- history-json\n";
const HISTORY_END_MARKER = "\n-->";

// Lista básica de insultos/palabras inapropiadas comunes, para no saludar
// a alguien con un "nombre" ofensivo. No pretende ser exhaustiva.
const BLOCKLIST = [
  "idiota", "estupido", "pendejo", "puto", "puta", "imbecil", "tarado",
  "boludo", "forro", "conchudo", "mierda", "pelotudo", "cornudo", "gil",
];

/**
 * Intenta extraer un nombre de persona "presentable" del pushName de WhatsApp.
 * Devuelve null si no parece un nombre válido (vacío, puro emoji, insulto, etc.)
 */
export function sanitizeName(rawName) {
  if (!rawName || typeof rawName !== "string") return null;

  const noEmoji = rawName.replace(EMOJI_REGEX, "").trim();
  const cleaned = noEmoji
    .replace(/[^\p{L}\s'.-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length < 2 || cleaned.length > 30) return null;
  if (!/[aeiouáéíóúAEIOUÁÉÍÓÚ]/.test(cleaned)) return null;

  // si el filtro se comió más de la mitad del texto original, probablemente
  // era puro emoji/símbolos/spam y no un nombre
  if (rawName.length > 4 && cleaned.length < rawName.length * 0.4) return null;

  const normalized = cleaned
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (BLOCKLIST.some((word) => normalized.includes(word))) return null;

  return cleaned;
}

export function conversationFileNameForJid(jid) {
  return jid.replace(/[^a-zA-Z0-9]/g, "_");
}

export function getConversationPath(vaultPath, conversationsFolder, jid) {
  const dir = path.join(vaultPath, conversationsFolder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.chmodSync(dir, 0o700);
  return path.join(dir, `${conversationFileNameForJid(jid)}.md`);
}

export function validateConversationHistory(history) {
  if (!Array.isArray(history)) return null;

  const validated = [];
  for (const turn of history) {
    if (!turn || typeof turn !== "object") return null;
    if (turn.role !== "user" && turn.role !== "assistant") return null;
    if (typeof turn.content !== "string") return null;

    const validatedTurn = {
      role: turn.role,
      content: turn.content,
    };

    if (turn.source === "bot" || turn.source === "human") {
      validatedTurn.source = turn.source;
    }

    if (typeof turn.time === "string" && !Number.isNaN(new Date(turn.time).getTime())) {
      validatedTurn.time = turn.time;
    }

    validated.push(validatedTurn);
  }

  return validated;
}

function extractStoredHistory(raw) {
  // Se usa el último marcador porque un cliente podría escribir un texto que
  // imite el comentario interno dentro de la parte legible del transcript.
  const markerStart = raw.lastIndexOf(HISTORY_START_MARKER);
  if (markerStart === -1) return null;

  const jsonStart = markerStart + HISTORY_START_MARKER.length;
  const jsonEnd = raw.indexOf(HISTORY_END_MARKER, jsonStart);
  if (jsonEnd === -1) return null;

  try {
    return validateConversationHistory(JSON.parse(raw.slice(jsonStart, jsonEnd)));
  } catch {
    return null;
  }
}

/**
 * Lee la nota de conversación existente y marca `isExpired` cuando pasaron
 * más de `expiryHours`, sin eliminar el historial guardado.
 */
export function loadConversation(filePath, expiryHours) {
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  const lastMessageMatch = raw.match(/last_message:\s*(.+)/);
  const contactMatch = raw.match(/contact:\s*(.+)/);
  const humanNotifiedAtMatch = raw.match(/human_notified_at:\s*(.+)/);
  const awaitingHumanMatch = raw.match(/awaiting_human:\s*(.+)/);
  const humanHandoffAtMatch = raw.match(/human_handoff_at:\s*(.+)/);
  const managedByBotMatch = raw.match(/managed_by_bot:\s*(.+)/);
  const history = extractStoredHistory(raw);

  if (!lastMessageMatch || !history) return null;

  const lastMessage = new Date(lastMessageMatch[1].trim());
  const ageHours = (Date.now() - lastMessage.getTime()) / (1000 * 60 * 60);
  if (Number.isNaN(ageHours)) return null;
  const isExpired = ageHours > expiryHours;

  const contactName = sanitizeName(contactMatch ? contactMatch[1].trim() : "");
  const humanNotifiedAtValue = humanNotifiedAtMatch
    ? humanNotifiedAtMatch[1].trim()
    : "";
  const humanNotifiedAt = humanNotifiedAtValue && !Number.isNaN(new Date(humanNotifiedAtValue).getTime())
    ? humanNotifiedAtValue
    : null;
  const humanHandoffAtValue = humanHandoffAtMatch
    ? humanHandoffAtMatch[1].trim()
    : "";
  const humanHandoffAt = humanHandoffAtValue && !Number.isNaN(new Date(humanHandoffAtValue).getTime())
    ? humanHandoffAtValue
    : null;
  // Compatibilidad con registros anteriores: un turno del cliente o una
  // respuesta de la IA demuestra que el chat sí era administrado por el bot.
  const inferredManagedConversation = history.some(
    (turn) => turn.role === "user" || turn.source === "bot"
  );
  const managedByBot = managedByBotMatch
    ? managedByBotMatch[1].trim() === "true"
    : inferredManagedConversation;

  return {
    contactName,
    lastMessageAt: lastMessage.toISOString(),
    humanNotifiedAt,
    awaitingHuman: awaitingHumanMatch?.[1]?.trim() === "true",
    humanHandoffAt,
    managedByBot,
    isExpired,
    history,
  };
}

/**
 * Guarda la conversación como un archivo .md legible, con el
 * historial estructurado embebido en un comentario HTML para poder releerlo.
 */
export function saveConversation(
  filePath,
  {
    jid,
    contactName,
    history,
    lastMessageAt = null,
    humanNotifiedAt = null,
    awaitingHuman = false,
    humanHandoffAt = null,
    managedByBot = true,
  }
) {
  const validatedHistory = validateConversationHistory(history);
  if (!validatedHistory) {
    throw new Error("El historial contiene mensajes con una estructura no permitida");
  }

  const parsedLastMessageAt = lastMessageAt ? new Date(lastMessageAt) : new Date();
  if (Number.isNaN(parsedLastMessageAt.getTime())) {
    throw new Error("La fecha del último mensaje no es válida");
  }

  const transcript = validatedHistory
    .map((turn) => {
      const time = new Date(turn.time || Date.now()).toLocaleString("es-CL", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      const who = turn.role === "user"
        ? contactName || "Cliente"
        : turn.source === "human"
          ? "Encargado"
          : "Asistente-IA";
      return `**${who}** (${time}): ${turn.content}`;
    })
    .join("\n\n");

  const content = `---
contact: ${contactName || "(sin nombre)"}
jid: ${jid}
last_message: ${parsedLastMessageAt.toISOString()}
human_notified_at: ${humanNotifiedAt || ""}
awaiting_human: ${awaitingHuman ? "true" : "false"}
human_handoff_at: ${humanHandoffAt || ""}
managed_by_bot: ${managedByBot ? "true" : "false"}
---

## Conversación

${transcript}

<!-- history-json
${JSON.stringify(validatedHistory)}
-->
`;

  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, content, { encoding: "utf-8", mode: 0o600 });
    fs.renameSync(temporaryPath, filePath);
    fs.chmodSync(filePath, 0o600);
  } catch (error) {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    throw error;
  }
}
