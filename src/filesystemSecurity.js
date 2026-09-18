import fs from "node:fs";
import path from "node:path";

export function secureDirectoryTree(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  fs.chmodSync(dirPath, 0o700);

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      secureDirectoryTree(fullPath);
    } else if (entry.isFile()) {
      fs.chmodSync(fullPath, 0o600);
    }
  }
}
