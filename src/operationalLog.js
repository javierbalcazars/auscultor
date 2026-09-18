export function formatContactForLog(remoteJid) {
  if (!remoteJid || typeof remoteJid !== "string") return "contacto-desconocido";
  const [identifier, domain = "chat"] = remoteJid.split("@");
  return `***${identifier.slice(-4)}@${domain}`;
}

export function logDuration(label, startedAt, details = "") {
  const durationMs = Math.max(0, Date.now() - startedAt);
  const suffix = details ? ` ${details}` : "";
  console.log(`📊 ${label} duration_ms=${durationMs}${suffix}`);
  return durationMs;
}
