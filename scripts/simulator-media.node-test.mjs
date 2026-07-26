import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SIMULATOR_MEDIA_BUCKET,
  createSimulatorMediaPacks,
} from "./simulator-media.mjs";

test("simulator media packs are versioned and use same-origin routes", async () => {
  const packs = await createSimulatorMediaPacks();
  assert.equal(SIMULATOR_MEDIA_BUCKET, "matsuri-simulator-media");

  for (const [game, pack] of Object.entries(packs)) {
    assert.match(pack.id, /^[a-f0-9]{20}$/);
    assert.ok(pack.assets.length > 0);
    for (const asset of pack.assets) {
      assert.match(asset.relativePath, /^(?:[^/]+\.(?:mp4|webm))$/);
      assert.equal(
        asset.publicPath,
        `/${pack.routeRoot}/videos/${pack.id}/${asset.relativePath}`,
      );
      assert.equal(
        asset.objectKey,
        `${pack.routeRoot}/videos/${pack.id}/${asset.relativePath}`,
      );
      assert.equal(
        asset.legacyKey,
        `${pack.routeRoot}/videos/${asset.relativePath}`,
      );
      assert.equal(asset.game, undefined);
    }
    assert.ok(game === "genshin" || game === "hsr");
  }
});
