import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export function createOfflinePack(assetsWithSources) {
  const assets = assetsWithSources.map(({ path, size }) => ({ path, size }));
  const hash = createHash("sha256");
  for (const asset of assetsWithSources) {
    hash.update(asset.path);
    hash.update(readFileSync(asset.sourcePath));
  }
  return { id: hash.digest("hex").slice(0, 20), assets };
}
