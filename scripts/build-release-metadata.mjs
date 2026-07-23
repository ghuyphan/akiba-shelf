import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { resolveReleaseId } from "./release-identity.mjs";

export function extractEntryAsset(html) {
  const match = html.match(
    /<script\b[^>]*\bsrc=["'](\/assets\/[^"']+\.js)["'][^>]*>/i,
  );
  if (!match) throw new Error("Could not find the application entry asset.");
  return match[1];
}

export async function buildReleaseMetadata({
  distRoot = resolve(process.cwd(), "dist"),
  release = resolveReleaseId(),
} = {}) {
  const [html, offlineManifest] = await Promise.all([
    readFile(resolve(distRoot, "index.html"), "utf8"),
    readFile(resolve(distRoot, "offline-assets.json"), "utf8").then(JSON.parse),
  ]);
  const metadata = {
    version: 1,
    release,
    entryAsset: extractEntryAsset(html),
    simulatorPacks: {
      genshin: offlineManifest.packs?.genshin?.id ?? null,
      hsr: offlineManifest.packs?.hsr?.id ?? null,
    },
  };
  await writeFile(
    resolve(distRoot, "release.json"),
    `${JSON.stringify(metadata)}\n`,
  );
  return metadata;
}

const isCli =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  const metadata = await buildReleaseMetadata();
  console.log(`Release metadata generated for ${metadata.release}.`);
}
