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
import { externalizeSimulatorBootstrap } from "./externalize-simulator-bootstrap.mjs";
import { SIMULATORS } from "./simulator-config.mjs";

const externalMedia = process.argv.includes("--external-media");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function readBuildMarker(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function runBuild({ workspaceName, output, envVar, mediaBaseUrl }) {
  return new Promise((resolveResult) => {
    const child = spawn(
      npmCommand,
      ["run", "build", "--workspace", workspaceName],
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
    resolve(root, simulator.workspaceRoot),
  );
  const mediaBaseUrl = externalMedia
    ? `/${simulator.routeRoot}/videos/${mediaPack.id}`
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
      workspaceName: simulator.workspaceName,
      output: stagingDir,
      envVar: simulator.envVar,
      mediaBaseUrl,
    });
    if (code !== 0) process.exit(code);
    rmSync(targetDev, { recursive: true, force: true });
    renameSync(targetStaging, targetDev);
    writeFileSync(markerPath, `${JSON.stringify(expectedMarker)}\n`);
  }

  externalizeSimulatorBootstrap(targetDev, `/${simulator.routeRoot}`);

  rmSync(targetDist, { recursive: true, force: true });
  mkdirSync(dirname(targetDist), { recursive: true });
  cpSync(targetDev, targetDist, { recursive: true });
  rmSync(resolve(targetDist, ".matsuri-build.json"), { force: true });
  if (externalMedia)
    rmSync(resolve(targetDist, "videos"), { recursive: true, force: true });
}

const mediaPacks = await createSimulatorMediaPacks();
for (const simulator of SIMULATORS)
  await buildSimulator(simulator, mediaPacks[simulator.game]);
