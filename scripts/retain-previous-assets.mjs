import { constants } from "node:fs";
import { copyFile, mkdir, readdir } from "node:fs/promises";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const viteAssetName = /^.+-[A-Za-z0-9_-]{8}\.[A-Za-z0-9.]+$/;
const simulatorImmutablePrefixes = [
  "gacha-simulator/internal/immutable/",
  "hsr-simulator/internal/immutable/",
];

function portablePath(path) {
  return path.split(sep).join("/");
}

export function isRetainedAssetPath(path) {
  const normalized = portablePath(path).replace(/^\.\//, "");
  if (
    simulatorImmutablePrefixes.some((prefix) => normalized.startsWith(prefix))
  ) {
    return true;
  }
  return (
    normalized.startsWith("assets/") && viteAssetName.test(basename(normalized))
  );
}

async function listFiles(root, directory = root) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(root, path)));
    else if (entry.isFile()) files.push(relative(root, path));
  }
  return files;
}

export async function retainPreviousAssets(previousDist, currentDist) {
  const previousRoot = resolve(previousDist);
  const currentRoot = resolve(currentDist);
  const retained = [];

  for (const relativePath of await listFiles(previousRoot)) {
    if (!isRetainedAssetPath(relativePath)) continue;
    const source = resolve(previousRoot, relativePath);
    const destination = resolve(currentRoot, relativePath);
    await mkdir(dirname(destination), { recursive: true });
    try {
      await copyFile(source, destination, constants.COPYFILE_EXCL);
      retained.push(portablePath(relativePath));
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
  }

  return retained;
}

const isCli =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const [, , previousDist, currentDist] = process.argv;
  if (!previousDist || !currentDist) {
    throw new Error(
      "Usage: node scripts/retain-previous-assets.mjs <previous-dist> <current-dist>",
    );
  }
  const retained = await retainPreviousAssets(previousDist, currentDist);
  console.log(`Retained ${retained.length} previous immutable assets.`);
}
