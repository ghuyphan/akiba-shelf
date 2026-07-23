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

const STOREFRONT_SHOP_ID = "00000000-0000-4000-8000-000000000002";
const CATALOG_SHOP_ID = "00000000-0000-4000-8000-000000000001";

function validStorefrontBootstrap() {
  return {
    shop: {
      id: STOREFRONT_SHOP_ID,
      name: "Demo Booth",
      slug: "demo-booth",
      active: true,
      accepting_orders: false,
      catalog_source_shop_id: CATALOG_SHOP_ID,
    },
    catalog_shop_id: CATALOG_SHOP_ID,
    products: [],
    has_more: false,
    booth: null,
    categories: [],
    promotion: {
      shop_id: CATALOG_SHOP_ID,
      enabled: false,
      buy_quantity: 3,
      free_quantity: 1,
      repeatable: true,
      qualifying_product_ids: [],
      reward_product_ids: [],
    },
    gacha_enabled: false,
  };
}

function fetchForBootstrapPayload(payload) {
  return async (url) => {
    if (String(url).includes("/rest/v1/rpc/get_storefront_bootstrap")) {
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
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
    requests.push({
      url: String(url),
      method: init.method ?? "GET",
      headers: init.headers,
      body: init.body,
    });
    if (String(url).includes("/functions/v1/create-order")) {
      return new Response(null, {
        status: 204,
        headers: { "access-control-allow-origin": "https://matsuri.pro" },
      });
    }
    if (String(url).includes("/rest/v1/rpc/get_storefront_bootstrap")) {
      return new Response(JSON.stringify(validStorefrontBootstrap()), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
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
  assert.equal(
    requests.at(-1).url,
    "https://project.supabase.co/functions/v1/create-order",
  );
  assert.equal(requests.at(-1).method, "OPTIONS");
  const bootstrapRequest = requests.find((request) =>
    request.url.endsWith("/rest/v1/rpc/get_storefront_bootstrap"),
  );
  assert.equal(bootstrapRequest.method, "POST");
  assert.equal(
    bootstrapRequest.body,
    JSON.stringify({ p_shop_slug: "demo-booth" }),
  );
  assert.equal(bootstrapRequest.headers.apikey, "public-anon-key");
  assert.equal("authorization" in bootstrapRequest.headers, false);
  assert.equal(
    requests.filter((request) => request.method === "POST").length,
    1,
  );
});

test("smoke identifies the storefront when its bootstrap RPC fails", async () => {
  const fetchImpl = async (url) => {
    if (String(url).includes("/rest/v1/rpc/get_storefront_bootstrap")) {
      return new Response(
        JSON.stringify({ message: "Shop not found or inactive" }),
        {
          status: 404,
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

  await assert.rejects(
    smokeProduction({
      baseUrl: "https://matsuri.pro",
      supabaseUrl: "https://project.supabase.co",
      supabaseAnonKey: "public-anon-key",
      storefrontSlug: "demo-booth",
      fetchImpl,
    }),
    new Error(
      'storefront bootstrap for "demo-booth" expected HTTP 200, received 404: Shop not found or inactive',
    ),
  );
});

test("smoke uses CatalogPage validation for UUID, product, and booth data", async (t) => {
  const validPayload = validStorefrontBootstrap();
  const cases = [
    {
      name: "invalid shop UUID",
      payload: {
        ...validPayload,
        shop: { ...validPayload.shop, id: "not-a-uuid" },
      },
      expected: /invalid CatalogPage payload: shop\.id:/,
    },
    {
      name: "invalid product",
      payload: { ...validPayload, products: [{ id: "product-only" }] },
      expected: /invalid CatalogPage payload: products\.0\.name:/,
    },
    {
      name: "invalid booth",
      payload: { ...validPayload, booth: {} },
      expected: /invalid CatalogPage payload: booth\.booth_name:/,
    },
  ];

  for (const regression of cases) {
    await t.test(regression.name, async () => {
      await assert.rejects(
        smokeProduction({
          baseUrl: "https://matsuri.pro",
          supabaseUrl: "https://project.supabase.co",
          supabaseAnonKey: "public-anon-key",
          storefrontSlug: "demo-booth",
          fetchImpl: fetchForBootstrapPayload(regression.payload),
        }),
        regression.expected,
      );
    });
  }
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

test("notification cron operation configures and verifies one active job", async () => {
  const operation = await readFile(
    new URL("./configure-notification-cron.sql", import.meta.url),
    "utf8",
  );
  const runbook = await readFile(
    new URL("../docs/operations.md", import.meta.url),
    "utf8",
  );

  const configureSchedule = operation.indexOf(
    "configure_order_notification_drain_schedule()",
  );
  const verifySchedule = operation.indexOf("matching_jobs <> 1");
  assert.ok(configureSchedule >= 0);
  assert.ok(verifySchedule > configureSchedule);
  assert.match(operation, /jobname = 'drain-order-notification-queue'/);
  assert.match(operation, /schedule = '\* \* \* \* \*'/);
  assert.match(operation, /and active/);
  assert.doesNotMatch(operation, /decrypted_secrets/);

  const vaultSetup = runbook.indexOf("vault.create_secret(");
  const cronOperation = runbook.indexOf(
    "--file scripts/configure-notification-cron.sql",
  );
  assert.ok(vaultSetup >= 0);
  assert.ok(cronOperation > vaultSetup);
});
