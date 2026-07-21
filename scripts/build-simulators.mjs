import { cpSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const simulators = [
  {
    label: "Genshin",
    workspace: "matsuri-wish-simulator",
    devDir: ".gacha-dist",
    distDir: "dist/gacha-simulator",
    envVar: "GACHA_OUTPUT_DIR",
  },
  {
    label: "HSR",
    workspace: "matsuri-hsr-warp-simulator",
    devDir: ".hsr-gacha-dist",
    distDir: "dist/hsr-simulator",
    envVar: "GACHA_OUTPUT_DIR",
  },
];

const build = async ({ label, workspace, devDir, distDir, envVar }) => {
  console.log(`Building ${label} simulator...`);
  const targetDev = resolve(process.cwd(), devDir);
  const targetDist = resolve(process.cwd(), distDir);

  const code = await new Promise((res) => {
    const child = spawn(
      npmCommand,
      ["run", "build", "--workspace", workspace],
      {
        cwd: process.cwd(),
        env: { ...process.env, [envVar]: `../../${devDir}` },
        stdio: "inherit",
      },
    );
    child.on("error", () => res(1));
    child.on("exit", (c) => res(c ?? 1));
  });

  if (code === 0) {
    mkdirSync(targetDist, { recursive: true });
    cpSync(targetDev, targetDist, { recursive: true });
  }
  return code;
};

const results = [];
for (const simulator of simulators) {
  results.push(await build(simulator));
}
if (results.some((code) => code !== 0)) process.exit(1);
