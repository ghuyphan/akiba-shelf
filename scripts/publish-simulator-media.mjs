import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  SIMULATOR_MEDIA_BUCKET,
  createSimulatorMediaPacks,
} from "./simulator-media.mjs";

if (process.env.SIMULATOR_MEDIA_SKIP_UPLOAD === "1") {
  console.log("Skipping simulator media upload by request.");
  process.exit(0);
}

const bucket = process.env.SIMULATOR_MEDIA_BUCKET || SIMULATOR_MEDIA_BUCKET;
const wrangler = resolve(
  process.cwd(),
  "node_modules/.bin",
  process.platform === "win32" ? "wrangler.cmd" : "wrangler",
);

function runWrangler(args, { quiet = false } = {}) {
  const result = spawnSync(wrangler, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: quiet ? "ignore" : "inherit",
  });
  return result.status === 0;
}

function remoteObjectExists(key) {
  return runWrangler(
    ["r2", "object", "get", `${bucket}/${key}`, "--remote", "--pipe"],
    { quiet: true },
  );
}

function uploadObject(key, sourcePath, contentType, cacheControl) {
  const args = [
    "r2",
    "object",
    "put",
    `${bucket}/${key}`,
    "--remote",
    "--force",
    "--file",
    sourcePath,
    "--content-type",
    contentType,
    "--cache-control",
    cacheControl,
  ];
  if (!runWrangler(args)) throw new Error(`Could not upload R2 object ${key}.`);
}

function writeManifest(directory, pack) {
  const path = join(directory, `${pack.game}-${pack.id}.json`);
  writeFileSync(
    path,
    `${JSON.stringify({
      version: 1,
      game: pack.game,
      id: pack.id,
      assets: pack.assets.map(({ relativePath, size }) => ({
        path: relativePath,
        size,
      })),
    })}\n`,
  );
  return path;
}

function publishVersionedPack(pack, temporaryDirectory) {
  const markerKey = `${pack.routeRoot}/videos/${pack.id}/manifest.json`;
  if (remoteObjectExists(markerKey)) {
    console.log(`${pack.game} media ${pack.id} already exists in R2.`);
    return;
  }

  for (const asset of pack.assets) {
    console.log(`Uploading ${pack.game} media: ${asset.relativePath}`);
    uploadObject(
      asset.objectKey,
      asset.sourcePath,
      asset.contentType,
      "public, max-age=31536000, immutable",
    );
  }
  uploadObject(
    markerKey,
    writeManifest(temporaryDirectory, pack),
    "application/json",
    "public, max-age=31536000, immutable",
  );
}

function publishLegacyFallback(pack, temporaryDirectory) {
  const markerKey = `${pack.routeRoot}/videos/legacy-manifest.json`;
  if (remoteObjectExists(markerKey)) return;

  for (const asset of pack.assets) {
    console.log(`Uploading ${pack.game} rollback media: ${asset.relativePath}`);
    uploadObject(
      asset.legacyKey,
      asset.sourcePath,
      asset.contentType,
      "public, max-age=31536000, immutable",
    );
  }
  uploadObject(
    markerKey,
    writeManifest(temporaryDirectory, pack),
    "application/json",
    "public, max-age=31536000, immutable",
  );
}

const temporaryDirectory = mkdtempSync(join(tmpdir(), "matsuri-r2-media-"));
try {
  const packs = await createSimulatorMediaPacks();
  for (const pack of Object.values(packs)) {
    publishVersionedPack(pack, temporaryDirectory);
    publishLegacyFallback(pack, temporaryDirectory);
  }
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

console.log("Simulator media is available in R2.");
