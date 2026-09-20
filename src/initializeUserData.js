import fs from "node:fs";
import path from "node:path";
import { DATA_ROOT, PROJECT_ROOT } from "./config.js";

const DIRECTORIES = ["Vault/FAQs", "Vault/Chats", "data", ".local"];

export function initializeUserData({ dataRoot = DATA_ROOT, projectRoot = PROJECT_ROOT } = {}) {
  fs.mkdirSync(dataRoot, { recursive: true, mode: 0o700 });
  for (const directory of DIRECTORIES) fs.mkdirSync(path.join(dataRoot, directory), { recursive: true, mode: 0o700 });
  const faqDirectory = path.join(dataRoot, "Vault", "FAQs");
  const hasFaq = fs.readdirSync(faqDirectory).some((name) => name.toLowerCase().endsWith(".md"));
  if (!hasFaq) {
    const candidates = [
      path.join(projectRoot, "packaging", "default-data", "Vault", "FAQs"),
          ];
    const templateDirectory = candidates.find((candidate) => fs.existsSync(candidate));
    if (!templateDirectory) throw new Error("No se encontró la plantilla inicial de FAQs");
    for (const entry of fs.readdirSync(templateDirectory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) continue;
      fs.copyFileSync(path.join(templateDirectory, entry.name), path.join(faqDirectory, entry.name));
      fs.chmodSync(path.join(faqDirectory, entry.name), 0o600);
    }
  }
  return { dataRoot, faqDirectory };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const result = initializeUserData();
  console.log(result.dataRoot);
}
