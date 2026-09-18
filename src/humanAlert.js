function formatContactIdentifier(remoteJid) {
  if (remoteJid?.endsWith("@s.whatsapp.net")) {
    return `+${remoteJid.split("@")[0]}`;
  }
  return remoteJid || "No disponible";
}

export function buildHumanAlert({ remoteJid, contactName, text, reason, createdAt, now = new Date(createdAt || Date.now()) }) {
  const time = now.toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "medium",
  });
  const limitedText = String(text || "").trim().slice(0, 1500);
  const limitedReason = (reason || "No se encontró información suficiente en el Vault")
    .trim()
    .slice(0, 300);
  return `⚠️ Consulta que requiere atención humana

Cliente: ${contactName || "Sin nombre disponible"}
Identificador del chat: ${formatContactIdentifier(remoteJid)}
Consulta: ${limitedText}
Motivo: ${limitedReason}
Hora: ${time}`;
}
