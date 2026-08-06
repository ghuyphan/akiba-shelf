import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SIMULATORS } from "./simulator-config.mjs";

const root = process.cwd();
const rootPackage = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf8"),
);
const ignoredPaths = new Set(
  readFileSync(resolve(root, ".gitignore"), "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\/$/, ""))
    .filter(Boolean),
);

const failures = [];
for (const simulator of SIMULATORS) {
  const packagePath = resolve(root, simulator.workspaceRoot, "package.json");
  if (!existsSync(packagePath)) {
    failures.push(
      `${simulator.game}: missing ${simulator.workspaceRoot}/package.json`,
    );
    continue;
  }

  const workspacePackage = JSON.parse(readFileSync(packagePath, "utf8"));
  if (!rootPackage.workspaces?.includes(simulator.workspaceRoot))
    failures.push(
      `${simulator.game}: workspace is not owned by the root lockfile`,
    );
  if (workspacePackage.name !== simulator.workspaceName)
    failures.push(
      `${simulator.game}: package name does not match the build contract`,
    );
  for (const script of ["build", "check"]) {
    if (!workspacePackage.scripts?.[script])
      failures.push(`${simulator.game}: missing required ${script} script`);
  }
  for (const lockfile of ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"]) {
    if (existsSync(resolve(root, simulator.workspaceRoot, lockfile)))
      failures.push(
        `${simulator.game}: nested ${lockfile} bypasses the root workspace lockfile`,
      );
  }
  if (!ignoredPaths.has(simulator.devDir))
    failures.push(
      `${simulator.game}: generated output ${simulator.devDir} must stay ignored`,
    );
  if (!existsSync(resolve(root, simulator.workspaceRoot, "static", "videos")))
    failures.push(
      `${simulator.game}: authoritative video source directory is missing`,
    );
}

if (failures.length) {
  for (const failure of failures)
    console.error(`Simulator contract: ${failure}`);
  process.exit(1);
}

console.log("Simulator workspace and output contracts passed.");
