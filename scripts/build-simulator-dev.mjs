import { existsSync, renameSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { externalizeSimulatorBootstrap } from "./externalize-simulator-bootstrap.mjs";
import { getSimulator } from "./simulator-config.mjs";

const game = process.argv[2];
const ifMissing = process.argv.includes("--if-missing");
const simulator = getSimulator(game);

if (!simulator) {
  console.error(
    "Usage: node scripts/build-simulator-dev.mjs <genshin|hsr> [--if-missing]",
  );
  process.exit(1);
}

const root = process.cwd();
const outputPath = resolve(root, simulator.devDir);
const stagingPath = `${outputPath}.next`;
const previousPath = `${outputPath}.previous`;

if (ifMissing && existsSync(resolve(outputPath, "index.html"))) {
  console.log(`${game} simulator is ready; skipping the rebuild.`);
  process.exit(0);
}

rmSync(stagingPath, { recursive: true, force: true });
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(
  npmCommand,
  ["run", "build", "--workspace", simulator.workspaceName],
  {
    cwd: root,
    env: {
      ...process.env,
      [simulator.envVar]: `../../${simulator.devDir}.next`,
    },
    stdio: "inherit",
  },
);

if (result.status !== 0) {
  rmSync(stagingPath, { recursive: true, force: true });
  process.exit(result.status ?? 1);
}

externalizeSimulatorBootstrap(stagingPath, `/${simulator.routeRoot}`);
rmSync(previousPath, { recursive: true, force: true });
if (existsSync(outputPath)) renameSync(outputPath, previousPath);
renameSync(stagingPath, outputPath);
rmSync(previousPath, { recursive: true, force: true });
console.log(`${game} simulator rebuilt without interrupting the dev server.`);
