import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exporter = path.join(projectRoot, "scripts", "export-public.sh");

if (fs.existsSync(exporter)) {
  const result = spawnSync("bash", [exporter, "--check"], { cwd: projectRoot, stdio: "inherit" });
  process.exit(result.status ?? 1);
}

const forbiddenPaths = [".env", "auth_session", "data", "private"];
const requiredPaths = [
  ".env.example", "README.md", "LICENSE", "package.json", "package-lock.json",
  "src", "test", "Vault/FAQs", "Vault/Chats/.gitkeep",
];
const errors = [];

for (const relativePath of forbiddenPaths) {
  if (fs.existsSync(path.join(projectRoot, relativePath))) errors.push(`ruta privada presente: ${relativePath}`);
}
for (const relativePath of requiredPaths) {
  if (!fs.existsSync(path.join(projectRoot, relativePath))) errors.push(`ruta pública requerida ausente: ${relativePath}`);
}

const textExtensions = new Set([".js", ".mjs", ".json", ".md", ".yml", ".yaml", ".html", ".css", ".sh", ".service", ".example", ""]);
const ignoredDirectories = new Set([".git", "node_modules", ".local"]);
const secretPattern = /OPENAI_API_KEY=sk-[A-Za-z0-9_-]{20,}/;
const privateReferencePattern = new RegExp([
  ["", "home", "xavy"].join("/"),
  ["Glamping", "Llollelhue"].join(" "),
].join("|"));

function inspect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    const relativePath = path.relative(projectRoot, fullPath);
    if (entry.isDirectory()) {
      inspect(fullPath);
      continue;
    }
    if (!entry.isFile() || !textExtensions.has(path.extname(entry.name))) continue;
    const content = fs.readFileSync(fullPath, "utf8");
    if (secretPattern.test(content)) errors.push(`posible clave de OpenAI en ${relativePath}`);
    if (privateReferencePattern.test(content)) errors.push(`referencia privada en ${relativePath}`);
  }
}

inspect(projectRoot);
const chatFiles = fs.readdirSync(path.join(projectRoot, "Vault", "Chats"))
  .filter((name) => name !== ".gitkeep");
if (chatFiles.length > 0) errors.push("Vault/Chats contiene archivos privados");

if (errors.length > 0) {
  console.error("Validación pública rechazada:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Proyecto público validado: no se detectaron rutas privadas, chats ni secretos.");
