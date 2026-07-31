import { readFile } from "node:fs/promises";

const worker = await readFile(
  new URL("../dist/sw.js", import.meta.url),
  "utf8",
);

const requiredContracts = [
  "app-route-chunks-v2",
  "x-matsuri-stale-asset",
  'includes("javascript")',
  'includes("text/css")',
];

for (const contract of requiredContracts) {
  if (!worker.includes(contract)) {
    throw new Error(`Generated service worker is missing ${contract}.`);
  }
}

if (worker.includes("STALE_APP_ASSET_HEADER")) {
  throw new Error(
    "Generated service worker contains an unresolved cache guard.",
  );
}

console.log("Generated service worker cache guard is valid.");
