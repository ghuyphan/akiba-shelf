import { spawnSync } from "node:child_process";
import { SIMULATORS } from "./simulator-config.mjs";

const cleanSummary =
  /svelte-check found 0 errors(?:,| and) 0 warnings(?:, and 0 hints)?/;

for (const { workspaceRoot } of SIMULATORS) {
  const result = spawnSync(
    "npm",
    ["run", "check", "--workspace", workspaceRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  process.stdout.write(output);

  if (result.status !== 0) process.exit(result.status || 1);
  if (!cleanSummary.test(output)) {
    console.error(`Simulator diagnostics must be clean: ${workspaceRoot}`);
    process.exit(1);
  }
}
