import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { architectureViolations } from "./check-architecture.mjs";
import { buildReleaseMetadata } from "./build-release-metadata.mjs";
import { normalizeReleaseId } from "./release-identity.mjs";
import { createSimulatorCacheVersion } from "./simulator-cache-version.mjs";
import { smokeProduction } from "./smoke-production.mjs";

async function withTempDirectory(run) {
  const root = await mkdtemp(join(tmpdir(), "matsuri-operations-"));
  try {
    return await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function write(root, path, contents) {
  const destination = join(root, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, contents);
}

test("normalizes safe release identifiers", () => {
  assert.equal(normalizeReleaseId(" abc-123\n"), "abc-123");
  assert.throws(() => normalizeReleaseId("release with spaces"));
});

test("writes deterministic release metadata", () =>
  withTempDirectory(async (root) => {
    await write(
      root,
      "index.html",
      '<script type="module" src="/assets/index-Ab12_cd3.js"></script>',
    );
    await write(
      root,
      "offline-assets.json",
      JSON.stringify({
        packs: { genshin: { id: "gen-1" }, hsr: { id: "hsr-1" } },
      }),
    );
    const metadata = await buildReleaseMetadata({
      distRoot: root,
      release: "release-1",
    });
    assert.deepEqual(metadata, {
      version: 1,
      release: "release-1",
      entryAsset: "/assets/index-Ab12_cd3.js",
      simulatorPacks: { genshin: "gen-1", hsr: "hsr-1" },
    });
    assert.deepEqual(
      JSON.parse(await readFile(join(root, "release.json"), "utf8")),
      metadata,
    );
  }));

test("changes the simulator cache version only when simulator sources change", () =>
  withTempDirectory(async (root) => {
    await write(root, "package.json", "{}\n");
    await write(root, "src/sw.js", "const version = 1;\n");
    const first = await createSimulatorCacheVersion(root);
    const repeated = await createSimulatorCacheVersion(root);
    await write(root, "src/sw.js", "const version = 2;\n");
    const changed = await createSimulatorCacheVersion(root);
    assert.equal(first, repeated);
    assert.notEqual(first, changed);
  }));

test("smoke checks routes, assets, storefront data, and checkout preflight", async () => {
  const requests = [];
  const fetchImpl = async (url, init = {}) => {
    requests.push({ url: String(url), method: init.method ?? "GET" });
    if (String(url).includes("/functions/v1/create-order")) {
      return new Response(null, {
        status: 204,
        headers: { "access-control-allow-origin": "https://matsuri.pro" },
      });
    }
    if (String(url).includes("/rest/v1/rpc/get_storefront_bootstrap")) {
      return new Response(
        JSON.stringify({
          shop: { id: "shop-id" },
          catalog_shop_id: "shop-id",
          products: [],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }
    if (/\.(?:png)$/.test(String(url))) {
      return new Response("image", {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    }
    return new Response("<!doctype html>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  };
  const result = await smokeProduction({
    baseUrl: "https://matsuri.pro",
    supabaseUrl: "https://project.supabase.co",
    supabaseAnonKey: "public-anon-key",
    fetchImpl,
  });
  assert.equal(result.checks, 8);
  assert.deepEqual(requests.at(-1), {
    url: "https://project.supabase.co/functions/v1/create-order",
    method: "OPTIONS",
  });
  assert.equal(
    requests.filter((request) => request.method === "POST").length,
    1,
  );
});

test("reports route and Supabase boundary violations", () =>
  withTempDirectory(async (root) => {
    await write(
      root,
      "src/components/Bad.tsx",
      'import Page from "../pages/HomePage";\nimport { createClient } from "@supabase/supabase-js";\n',
    );
    await write(
      root,
      "src/pages/HomePage.tsx",
      "export default function HomePage() {}\n",
    );
    const violations = await architectureViolations(root);
    assert.equal(violations.length, 2);
    assert.match(violations[0], /route pages/);
    assert.match(violations[1], /Supabase SDK/);
  }));
