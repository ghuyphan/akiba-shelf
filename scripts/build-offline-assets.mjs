import { readdir, stat, writeFile } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";

const distRoot = resolve(process.cwd(), "dist");
const packRoots = {
  genshin: resolve(distRoot, "gacha-simulator"),
  hsr: resolve(distRoot, "hsr-simulator"),
};
const ignoredExtensions = new Set([".map", ".br", ".gz"]);

async function listFiles(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(root, path)));
    else if (entry.name !== ".nojekyll" && !ignoredExtensions.has(extname(entry.name))) {
      const size = (await stat(path)).size;
      const pathname = `/${relative(distRoot, path).split(sep).join("/")}`;
      files.push({ path: pathname, size });
    }
  }
  return files;
}

const packs = Object.fromEntries(
  await Promise.all(
    Object.entries(packRoots).map(async ([game, root]) => [game, await listFiles(root)]),
  ),
);
await writeFile(
  resolve(distRoot, "offline-assets.json"),
  `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), packs })}\n`,
);
console.log("Offline simulator asset manifest generated.");
