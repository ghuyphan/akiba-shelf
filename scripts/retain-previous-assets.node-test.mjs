import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  isRetainedAssetPath,
  retainPreviousAssets,
} from "./retain-previous-assets.mjs";

test("recognizes only versioned app and simulator immutable assets", () => {
  assert.equal(isRetainedAssetPath("assets/index-Ab12_cd3.js"), true);
  assert.equal(
    isRetainedAssetPath("gacha-simulator/internal/immutable/chunks/app.js"),
    true,
  );
  assert.equal(isRetainedAssetPath("assets/runtime.js"), false);
  assert.equal(isRetainedAssetPath("offline-assets.json"), false);
  assert.equal(isRetainedAssetPath("gacha-simulator/videos/event.mp4"), false);
});

test("copies only missing allowlisted assets without overwriting current files", async () => {
  const root = await mkdtemp(join(tmpdir(), "matsuri-retain-assets-"));
  const previous = join(root, "previous");
  const current = join(root, "current");
  const files = new Map([
    ["assets/index-Ab12_cd3.js", "previous-index"],
    ["assets/catalog-Zx98_yW7.css", "previous-catalog"],
    ["assets/runtime.js", "unversioned"],
    ["gacha-simulator/internal/immutable/chunks/app.js", "genshin"],
    ["hsr-simulator/internal/immutable/assets/app.css", "hsr"],
    ["gacha-simulator/videos/event.mp4", "removed-media"],
    ["offline-assets.json", "previous-manifest"],
  ]);

  try {
    for (const [path, contents] of files) {
      const destination = join(previous, path);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, contents);
    }
    const existing = join(current, "assets/index-Ab12_cd3.js");
    await mkdir(dirname(existing), { recursive: true });
    await writeFile(existing, "current-index");

    const retained = await retainPreviousAssets(previous, current);

    assert.deepEqual(retained.sort(), [
      "assets/catalog-Zx98_yW7.css",
      "gacha-simulator/internal/immutable/chunks/app.js",
      "hsr-simulator/internal/immutable/assets/app.css",
    ]);
    assert.equal(await readFile(existing, "utf8"), "current-index");
    assert.equal(
      await readFile(join(current, "assets/catalog-Zx98_yW7.css"), "utf8"),
      "previous-catalog",
    );
    await assert.rejects(readFile(join(current, "offline-assets.json")));
    await assert.rejects(
      readFile(join(current, "gacha-simulator/videos/event.mp4")),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
