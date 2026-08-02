import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import { SIMULATORS } from "./simulator-config.mjs";

export const SIMULATOR_MEDIA_BUCKET = "matsuri-simulator-media";
export const SIMULATOR_MEDIA_DELIVERY_VERSION = "security-headers-v3";

export const SIMULATOR_MEDIA_GAMES = Object.fromEntries(
  SIMULATORS.map(({ game, routeRoot, workspaceRoot }) => [
    game,
    { routeRoot, sourceRoot: `${workspaceRoot}/static/videos` },
  ]),
);

const MEDIA_TYPES = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

async function collectMediaFiles(root, directory = root) {
  const files = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort(
    (left, right) => left.name.localeCompare(right.name),
  )) {
    const path = join(directory, entry.name);
    if (entry.isDirectory())
      files.push(...(await collectMediaFiles(root, path)));
    else if (entry.isFile() && MEDIA_TYPES[extname(entry.name).toLowerCase()])
      files.push(path);
  }
  return files;
}

export async function createSimulatorMediaPack(game, cwd = process.cwd()) {
  const config = SIMULATOR_MEDIA_GAMES[game];
  if (!config) throw new Error(`Unknown simulator media game: ${game}`);

  const sourceRoot = resolve(cwd, config.sourceRoot);
  const files = await collectMediaFiles(sourceRoot);
  if (!files.length) throw new Error(`${game} simulator has no media files.`);

  const hash = createHash("sha256");
  hash.update(SIMULATOR_MEDIA_DELIVERY_VERSION);
  const assets = [];
  for (const sourcePath of files) {
    const relativePath = relative(sourceRoot, sourcePath).split(sep).join("/");
    const bytes = await readFile(sourcePath);
    const size = (await stat(sourcePath)).size;
    hash.update(relativePath);
    hash.update(bytes);
    assets.push({
      contentType: MEDIA_TYPES[extname(sourcePath).toLowerCase()],
      relativePath,
      size,
      sourcePath,
    });
  }

  const id = hash.digest("hex").slice(0, 20);
  return {
    game,
    id,
    routeRoot: config.routeRoot,
    assets: assets.map((asset) => ({
      ...asset,
      legacyKey: `${config.routeRoot}/videos/${asset.relativePath}`,
      objectKey: `${config.routeRoot}/videos/${id}/${asset.relativePath}`,
      publicPath: `/${config.routeRoot}/videos/${id}/${asset.relativePath}`,
    })),
  };
}

export async function createSimulatorMediaPacks(cwd = process.cwd()) {
  const entries = await Promise.all(
    Object.keys(SIMULATOR_MEDIA_GAMES).map(async (game) => [
      game,
      await createSimulatorMediaPack(game, cwd),
    ]),
  );
  return Object.fromEntries(entries);
}
