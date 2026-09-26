import fs from "node:fs";
import path from "node:path";
import { DATA_ROOT, PROJECT_ROOT } from "./config.js";

const DIRECTORIES = ["Vault/FAQs", "Vault/Chats", "data", ".local"];

export function initializeUserData({ dataRoot = DATA_ROOT, projectRoot = PROJECT_ROOT } = {}) {
  fs.mkdirSync(dataRoot, { recursive: true, mode: 0o700 });
  for (const directory of DIRECTORIES) fs.mkdirSync(path.join(dataRoot, directory), { recursive: true, mode: 0o700 });
  const faqDirectory = path.join(dataRoot, "Vault", "FAQs");
  const candidates = [path.join(projectRoot, "packaging", "default-data", "Vault", "FAQs")];
  const templateDirectory = candidates.find((candidate) => fs.existsSync(candidate));
  if (!templateDirectory) throw new Error("No se encontró la plantilla inicial de FAQs");
  const templateEntries = fs.readdirSync(templateDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"));
  const existingNames = new Set(fs.readdirSync(faqDirectory).filter((name) => name.toLowerCase().endsWith(".md")));
  const hasBundledFaq = templateEntries.some((entry) => existingNames.has(entry.name));
  if (!existingNames.size || hasBundledFaq) {
    for (const entry of templateEntries) {
      const target = path.join(faqDirectory, entry.name);
      if (fs.existsSync(target)) continue;
      fs.copyFileSync(path.join(templateDirectory, entry.name), target);
      fs.chmodSync(target, 0o600);
    }
  }
  return { dataRoot, faqDirectory };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const result = initializeUserData();
  console.log(result.dataRoot);
}
