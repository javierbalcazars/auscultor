import fs from "node:fs";
import { METRICS_PATH } from "../src/config.js";

if (!fs.existsSync(METRICS_PATH)) {
  console.log("Todavía no existen métricas. Se crearán cuando el bot procese actividad.");
  process.exit(0);
}

const metrics = JSON.parse(fs.readFileSync(METRICS_PATH, "utf8"));
console.log(`Métricas desde: ${metrics.startedAt}`);
console.log(`Última actualización: ${metrics.updatedAt}`);
console.log("\nContadores:");
for (const [name, value] of Object.entries(metrics.counters || {}).sort()) {
  console.log(`- ${name}: ${value}`);
}
console.log("\nDuraciones:");
for (const [name, value] of Object.entries(metrics.durations || {}).sort()) {
  console.log(`- ${name}: promedio ${value.averageMs} ms, máximo ${value.maxMs} ms, ${value.count} muestra(s)`);
}
