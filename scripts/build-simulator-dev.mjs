import { existsSync, renameSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const game = process.argv[2];
const ifMissing = process.argv.includes("--if-missing");
const simulators = {
  genshin: {
    workspace: "matsuri-wish-simulator",
    output: ".gacha-dist",
  },
  hsr: {
    workspace: "matsuri-hsr-warp-simulator",
    output: ".hsr-gacha-dist",
  },
};
const simulator = simulators[game];

if (!simulator) {
  console.error(
    "Usage: node scripts/build-simulator-dev.mjs <genshin|hsr> [--if-missing]",
  );
  process.exit(1);
}

const root = process.cwd();
const outputPath = resolve(root, simulator.output);
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
  ["run", "build", "--workspace", simulator.workspace],
  {
    cwd: root,
    env: {
      ...process.env,
      GACHA_OUTPUT_DIR: `../../${simulator.output}.next`,
    },
    stdio: "inherit",
  },
);

if (result.status !== 0) {
  rmSync(stagingPath, { recursive: true, force: true });
  process.exit(result.status ?? 1);
}

rmSync(previousPath, { recursive: true, force: true });
if (existsSync(outputPath)) renameSync(outputPath, previousPath);
renameSync(stagingPath, outputPath);
rmSync(previousPath, { recursive: true, force: true });
console.log(`${game} simulator rebuilt without interrupting the dev server.`);
