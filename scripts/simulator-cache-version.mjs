import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

const sourceEntries = [
  "package.json",
  "src",
  "static",
  "svelte.config.js",
  "vite.config.js",
];

async function collectFiles(root, path, files) {
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const entryPath = join(path, entry.name);
    if (entry.isDirectory()) await collectFiles(root, entryPath, files);
    else if (entry.isFile()) files.push(entryPath);
  }
}

export async function createSimulatorCacheVersion(workspaceRoot) {
  const root = resolve(workspaceRoot);
  const files = [];
  for (const entry of sourceEntries) {
    const path = resolve(root, entry);
    try {
      const details = await stat(path);
      if (details.isDirectory()) await collectFiles(root, path, files);
      else if (details.isFile()) files.push(path);
    } catch {
      // Optional source entries differ between the vendored simulators.
    }
  }
  const hash = createHash("sha256");
  for (const file of files.sort()) {
    hash.update(relative(root, file).split(sep).join("/"));
    hash.update(await readFile(file));
  }
  return hash.digest("hex").slice(0, 16);
}
