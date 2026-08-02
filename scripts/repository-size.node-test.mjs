import assert from "node:assert/strict";
import test from "node:test";
import { validateLargeFiles } from "./repository-size.mjs";

const bytes = Buffer.from("large-file");
const metadata = {
  size: bytes.length,
  sha256: "eab3643925e02a5b34394903ef8ac014520d94321af8d69f15f5a7c3e7548420",
};
const baseline = {
  largeFileThresholdBytes: 1,
  files: { "allowed.bin": metadata },
};
const readFile = () => bytes;
const stat = () => ({ size: bytes.length });

test("accepts unchanged reviewed large files", () => {
  const result = validateLargeFiles({
    trackedFiles: ["allowed.bin"],
    baseline,
    readFile,
    stat,
  });
  assert.deepEqual(result.failures, []);
});

test("rejects new and stale large files", () => {
  const result = validateLargeFiles({
    trackedFiles: ["new.bin"],
    baseline,
    readFile,
    stat,
  });
  assert.deepEqual(result.failures, [
    "new tracked large file: new.bin (10 bytes)",
    "stale large-file baseline entry: allowed.bin",
  ]);
});
