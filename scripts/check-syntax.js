#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PROJECT_ROOT } from "../src/config.js";

const directories = ["src", "scripts", "test"];
const files = directories.flatMap((directory) =>
  fs.readdirSync(path.join(PROJECT_ROOT, directory), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => path.join(PROJECT_ROOT, directory, entry.name))
);

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`Sintaxis válida en ${files.length} archivo(s).`);
