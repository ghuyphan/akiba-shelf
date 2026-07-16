import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const simulators = [
  { label: "Genshin", workspace: "matsuri-wish-simulator" },
  { label: "HSR", workspace: "matsuri-hsr-warp-simulator" },
];

const build = ({ label, workspace }) =>
  new Promise((resolve) => {
    console.log(`Building ${label} simulator...`);
    const child = spawn(
      npmCommand,
      ["run", "build", "--workspace", workspace],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: "inherit",
      },
    );
    child.on("error", () => resolve(1));
    child.on("exit", (code) => resolve(code ?? 1));
  });

const results = await Promise.all(simulators.map(build));
if (results.some((code) => code !== 0)) process.exit(1);
