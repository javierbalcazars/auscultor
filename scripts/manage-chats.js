#!/usr/bin/env node
import path from "node:path";
import {
  VAULT_PATH,
  loadRuntimeConfig,
} from "../src/config.js";
import { conversationFileNameForJid } from "../src/conversationStore.js";
import {
  deleteConversationFile,
  inspectConversations,
  pruneExpiredConversations,
} from "../src/conversationRetention.js";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const command = args.find((arg) => !arg.startsWith("--")) || "list";
const commandIndex = args.indexOf(command);
const value = commandIndex >= 0 ? args[commandIndex + 1] : null;
const { conversationsFolder, conversationRetentionDays } = loadRuntimeConfig();
const directory = path.join(VAULT_PATH, conversationsFolder);

function printConversation(conversation) {
  const date = conversation.lastMessageAt || "fecha inválida";
  const status = conversation.expired ? "vencido" : "vigente";
  console.log(`${status.padEnd(8)} ${date} ${conversation.fileName}`);
}

if (command === "list") {
  const conversations = inspectConversations(directory, conversationRetentionDays);
  conversations.forEach(printConversation);
  console.log(`Total: ${conversations.length}. Retención configurada: ${conversationRetentionDays} días.`);
} else if (command === "prune") {
  const expired = pruneExpiredConversations(directory, conversationRetentionDays, { apply });
  expired.forEach(printConversation);
  console.log(
    apply
      ? `Eliminados: ${expired.length}.`
      : `Se eliminarían: ${expired.length}. Repite con --apply para confirmar.`
  );
} else if (command === "delete") {
  if (!value || value.startsWith("--")) {
    throw new Error("Uso: npm run chats -- delete <jid-o-archivo.md> [--apply]");
  }
  const fileName = value.endsWith(".md") ? path.basename(value) : `${conversationFileNameForJid(value)}.md`;
  const filePath = path.join(directory, fileName);
  const found = deleteConversationFile(filePath, { apply });
  if (!found) throw new Error(`No existe la conversación: ${fileName}`);
  console.log(apply ? `Conversación eliminada: ${fileName}` : `Se eliminaría: ${fileName}. Repite con --apply para confirmar.`);
} else {
  throw new Error("Comando desconocido. Usa: list, prune o delete.");
}
