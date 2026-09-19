import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { askLLM } from "../src/llm.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cases = JSON.parse(fs.readFileSync(path.join(root, "evals", "hospitality-cases.json"), "utf8"));
const live = process.argv.includes("--live");

function validateCase(item, index) {
  if (!item || typeof item !== "object") throw new Error(`Caso ${index + 1}: formato inválido`);
  for (const key of ["name", "context", "question"]) {
    if (typeof item[key] !== "string" || !item[key].trim()) throw new Error(`Caso ${index + 1}: falta ${key}`);
  }
  if (typeof item.needsHuman !== "boolean") throw new Error(`Caso ${index + 1}: needsHuman debe ser booleano`);
  if (!Array.isArray(item.requiredAny) || !Array.isArray(item.forbidden)) throw new Error(`Caso ${index + 1}: listas inválidas`);
}

function evaluate(item, result) {
  const reply = result.reply.toLocaleLowerCase("es");
  const required = item.requiredAny.map((value) => value.toLocaleLowerCase("es"));
  const forbidden = item.forbidden.map((value) => value.toLocaleLowerCase("es"));
  const failures = [];
  if (result.needsHuman !== item.needsHuman) failures.push(`needsHuman=${result.needsHuman}`);
  if (required.length > 0 && !required.some((value) => reply.includes(value))) failures.push("no incluyó un dato esperado");
  if (forbidden.some((value) => reply.includes(value))) failures.push("incluyó una afirmación prohibida");
  return failures;
}

cases.forEach(validateCase);
if (!live) {
  console.log(`${cases.length} evaluaciones válidas. Usa npm run evals:live para probar el modelo configurado.`);
  process.exit(0);
}

let failed = 0;
for (const item of cases) {
  try {
    const result = await askLLM([{ role: "user", content: item.question }], item.context);
    const failures = evaluate(item, result);
    if (failures.length > 0) {
      failed += 1;
      console.error(`✗ ${item.name}: ${failures.join(", ")}`);
    } else {
      console.log(`✓ ${item.name}`);
    }
  } catch (error) {
    failed += 1;
    console.error(`✗ ${item.name}: ${error.message}`);
  }
}

if (failed > 0) {
  console.error(`${failed}/${cases.length} evaluaciones fallaron.`);
  process.exit(1);
}
console.log(`${cases.length}/${cases.length} evaluaciones aprobadas.`);
