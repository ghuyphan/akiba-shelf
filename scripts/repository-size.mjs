import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function validateLargeFiles({ trackedFiles, baseline, readFile, stat }) {
  const actual = new Map();
  let simulatorMediaBytes = 0;
  let simulatorMediaFiles = 0;
  for (const path of trackedFiles) {
    const size = stat(path).size;
    if (
      /^vendor\/(gacha-simulator|hsr-simulator)\/static\/videos\//.test(path)
    ) {
      simulatorMediaBytes += size;
      simulatorMediaFiles += 1;
    }
    if (size < baseline.largeFileThresholdBytes) continue;
    actual.set(path, {
      size,
      sha256: createHash("sha256").update(readFile(path)).digest("hex"),
    });
  }

  const failures = [];
  for (const [path, metadata] of actual) {
    const expected = baseline.files[path];
    if (!expected)
      failures.push(`new tracked large file: ${path} (${metadata.size} bytes)`);
    else if (
      expected.size !== metadata.size ||
      expected.sha256 !== metadata.sha256
    )
      failures.push(
        `tracked large file changed without baseline review: ${path}`,
      );
  }
  for (const path of Object.keys(baseline.files)) {
    if (!actual.has(path))
      failures.push(`stale large-file baseline entry: ${path}`);
  }
  if (baseline.simulatorMedia) {
    if (simulatorMediaBytes > baseline.simulatorMedia.maxBytes)
      failures.push(
        `tracked simulator media exceeds budget: ${simulatorMediaBytes} > ${baseline.simulatorMedia.maxBytes} bytes`,
      );
    if (simulatorMediaFiles > baseline.simulatorMedia.maxFiles)
      failures.push(
        `tracked simulator media exceeds file limit: ${simulatorMediaFiles} > ${baseline.simulatorMedia.maxFiles}`,
      );
  }
  return { actual, failures, simulatorMediaBytes, simulatorMediaFiles };
}

function main() {
  const baseline = JSON.parse(
    readFileSync("config/repository-size-baseline.json", "utf8"),
  );
  const trackedFiles = execFileSync("git", ["ls-files", "-z"], {
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
    },
  })
    .split("\0")
    .filter((path) => path && existsSync(path));
  const { actual, failures, simulatorMediaBytes, simulatorMediaFiles } =
    validateLargeFiles({
      trackedFiles,
      baseline,
      readFile: readFileSync,
      stat: statSync,
    });

  const totalBytes = [...actual.values()].reduce(
    (sum, file) => sum + file.size,
    0,
  );
  console.log(
    `Tracked large files: ${actual.size}; baseline bytes: ${totalBytes}; simulator media: ${simulatorMediaFiles} files / ${simulatorMediaBytes} bytes.`,
  );
  if (failures.length) {
    for (const failure of failures)
      console.error(`Repository size: ${failure}`);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
