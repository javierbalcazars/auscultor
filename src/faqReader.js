import fs from "fs";
import path from "path";

/**
 * Recorre la carpeta de FAQs y carga todos los documentos Markdown autorizados.
 * Las carpetas ocultas o indicadas en `excludeDirs` nunca se incluyen.
 */
export function loadFaqDocuments(faqsPath, excludeDirs = []) {
  const notes = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".") || excludeDirs.includes(entry.name)) continue;
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        const content = fs.readFileSync(fullPath, "utf-8");
        const title = entry.name.replace(/\.md$/, "");
        notes.push({ file: fullPath, title, content });
      }
    }
  }

  walk(faqsPath);
  return notes;
}

/** Entrega a OpenAI el contenido completo de todas las FAQs cargadas. */
export function buildFaqContext(notes) {
  if (notes.length === 0) return "";
  return notes
    .map((note) => `### ${note.title}\n${note.content}`)
    .join("\n\n---\n\n");
}
