import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { createSimulatorCacheVersion } from "./simulator-cache-version.mjs";
import { createSimulatorMediaPacks } from "./simulator-media.mjs";

const externalMedia = process.argv.includes("--external-media");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const simulators = [
  {
    game: "genshin",
    label: "Genshin",
    workspace: "matsuri-wish-simulator",
    devDir: ".gacha-dist",
    distDir: "dist/gacha-simulator",
    envVar: "GACHA_OUTPUT_DIR",
    sourceRoot: "vendor/gacha-simulator",
  },
  {
    game: "hsr",
    label: "HSR",
    workspace: "matsuri-hsr-warp-simulator",
    devDir: ".hsr-gacha-dist",
    distDir: "dist/hsr-simulator",
    envVar: "GACHA_OUTPUT_DIR",
    sourceRoot: "vendor/hsr-simulator",
  },
];

function readBuildMarker(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function runBuild({ workspace, output, envVar, mediaBaseUrl }) {
  return new Promise((resolveResult) => {
    const child = spawn(
      npmCommand,
      ["run", "build", "--workspace", workspace],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          [envVar]: `../../${output}`,
          ...(mediaBaseUrl
            ? { VITE_SIMULATOR_MEDIA_BASE_URL: mediaBaseUrl }
            : {}),
        },
        stdio: "inherit",
      },
    );
    child.on("error", () => resolveResult(1));
    child.on("exit", (code) => resolveResult(code ?? 1));
  });
}

async function buildSimulator(simulator, mediaPack) {
  const root = process.cwd();
  const targetDev = resolve(root, simulator.devDir);
  const stagingDir = `${simulator.devDir}.next`;
  const targetStaging = resolve(root, stagingDir);
  const targetDist = resolve(root, simulator.distDir);
  const sourceVersion = await createSimulatorCacheVersion(
    resolve(root, simulator.sourceRoot),
  );
  const mediaBaseUrl = externalMedia
    ? `/${simulator.game === "genshin" ? "gacha-simulator" : "hsr-simulator"}/videos/${mediaPack.id}`
    : "";
  const markerPath = resolve(targetDev, ".matsuri-build.json");
  const expectedMarker = {
    sourceVersion,
    mediaMode: externalMedia ? "external" : "inline",
    mediaPackId: mediaPack.id,
  };
  const currentMarker = readBuildMarker(markerPath);

  if (
    currentMarker &&
    JSON.stringify(currentMarker) === JSON.stringify(expectedMarker) &&
    existsSync(resolve(targetDev, "index.html"))
  ) {
    console.log(`${simulator.label} simulator is ready; skipping the rebuild.`);
  } else {
    console.log(`Building ${simulator.label} simulator...`);
    rmSync(targetStaging, { recursive: true, force: true });
    const code = await runBuild({
      workspace: simulator.workspace,
      output: stagingDir,
      envVar: simulator.envVar,
      mediaBaseUrl,
    });
    if (code !== 0) process.exit(code);
    rmSync(targetDev, { recursive: true, force: true });
    renameSync(targetStaging, targetDev);
    writeFileSync(markerPath, `${JSON.stringify(expectedMarker)}\n`);
  }

  rmSync(targetDist, { recursive: true, force: true });
  mkdirSync(dirname(targetDist), { recursive: true });
  cpSync(targetDev, targetDist, { recursive: true });
  rmSync(resolve(targetDist, ".matsuri-build.json"), { force: true });
  if (externalMedia)
    rmSync(resolve(targetDist, "videos"), { recursive: true, force: true });
}

const mediaPacks = await createSimulatorMediaPacks();
for (const simulator of simulators)
  await buildSimulator(simulator, mediaPacks[simulator.game]);
