import { spawnSync } from "node:child_process";

const workspaces = ["vendor/gacha-simulator", "vendor/hsr-simulator"];
const cleanSummary =
  /svelte-check found 0 errors(?:,| and) 0 warnings(?:, and 0 hints)?/;

for (const workspace of workspaces) {
  const result = spawnSync("npm", ["run", "check", "--workspace", workspace], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  process.stdout.write(output);

  if (result.status !== 0) process.exit(result.status || 1);
  if (!cleanSummary.test(output)) {
    console.error(`Simulator diagnostics must be clean: ${workspace}`);
    process.exit(1);
  }
}
