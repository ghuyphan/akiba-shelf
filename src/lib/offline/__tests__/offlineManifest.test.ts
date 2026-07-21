import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createOfflinePack } from "../../../../scripts/offline-pack-identity.mjs";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("development offline manifest identity", () => {
  it("changes when file contents change without changing path or size", () => {
    const directory = mkdtempSync(join(tmpdir(), "matsuri-offline-pack-"));
    temporaryDirectories.push(directory);
    const sourcePath = join(directory, "index.html");
    const asset = {
      path: "/gacha-simulator/index.html",
      size: 4,
      sourcePath,
    };

    writeFileSync(sourcePath, "AAAA");
    const first = createOfflinePack([asset]);
    writeFileSync(sourcePath, "BBBB");
    const second = createOfflinePack([asset]);

    expect(second.id).not.toBe(first.id);
    expect(second.assets).toEqual(first.assets);
  });
});
