import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { architectureViolations } from "./check-architecture.mjs";
import { buildReleaseMetadata } from "./build-release-metadata.mjs";
import { normalizeReleaseId } from "./release-identity.mjs";
import { STOREFRONT_ROUTE_PRELOAD_SCRIPT } from "./storefront-route-preload.mjs";
import { createSimulatorCacheVersion } from "./simulator-cache-version.mjs";
import { smokeProduction } from "./smoke-production.mjs";
import { validateObservabilityConfig } from "./validate-observability-config.mjs";
import { CHECKOUT_CONTRACT_VERSION } from "../supabase/functions/_shared/checkoutContract.ts";

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

test("validates optional production observability configuration", () => {
  const base = {
    MATSURI_RELEASE: "abc-123",
    VITE_APP_ENV: "production",
    VITE_RUM_SAMPLE_RATE: "0.1",
  };

  assert.deepEqual(validateObservabilityConfig(base, { production: true }), {
    configured: false,
    environment: "production",
    sampleRate: 0.1,
    release: "abc-123",
  });
  assert.deepEqual(
    validateObservabilityConfig(
      {
        ...base,
        VITE_SENTRY_DSN:
          "https://0123456789abcdef0123456789abcdef@o123.ingest.sentry.io/456789",
        VITE_RUM_SAMPLE_RATE: "0",
      },
      { production: true },
    ),
    {
      configured: true,
      environment: "production",
      sampleRate: 0,
      release: "abc-123",
    },
  );

  assert.throws(
    () =>
      validateObservabilityConfig(
        { ...base, VITE_RUM_SAMPLE_RATE: "not-a-rate" },
        { production: true },
      ),
    /VITE_RUM_SAMPLE_RATE/,
  );
  assert.throws(
    () =>
      validateObservabilityConfig(
        { ...base, VITE_SENTRY_DSN: "https://example.com/project" },
        { production: true },
      ),
    /public-key DSN/,
  );
  assert.throws(
    () =>
      validateObservabilityConfig(
        {
          ...base,
          VITE_SENTRY_DSN:
            "https://0123456789abcdef0123456789abcdef@o123.ingest.sentry.io/project-id",
        },
        { production: true },
      ),
    /numeric project ID/,
  );
  assert.throws(
    () =>
      validateObservabilityConfig(
        {
          ...base,
          VITE_SENTRY_DSN:
            "https://0123456789abcdef0123456789abcdef@example.com/456789",
        },
        { production: true },
      ),
    /Content Security Policy/,
  );
  assert.throws(
    () =>
      validateObservabilityConfig(
        {
          ...base,
          VITE_SENTRY_DSN:
            "https://0123456789abcdef0123456789abcdef@sentry.io/456789",
        },
        { production: true },
      ),
    /Content Security Policy/,
  );
  assert.throws(
    () =>
      validateObservabilityConfig(
        { ...base, VITE_APP_ENV: "staging" },
        { production: true },
      ),
    /production Pages build/,
  );
  assert.throws(
    () =>
      validateObservabilityConfig(
        { ...base, MATSURI_RELEASE: "" },
        { production: true },
      ),
    /MATSURI_RELEASE/,
  );
});

test("keeps the Pages configuration on supported fields", async () => {
  const config = await readFile(
    new URL("../wrangler.jsonc", import.meta.url),
    "utf8",
  );
  assert.match(config, /"pages_build_output_dir": "\.\/dist"/);
  assert.match(config, /"compatibility_flags": \["nodejs_compat"\]/);
  assert.match(config, /"binding": "SIMULATOR_MEDIA"/);
  assert.match(config, /"bucket_name": "matsuri-simulator-media"/);
  assert.doesNotMatch(config, /"observability"/);
});

test("keeps browser telemetry on the deployed release identity", async () => {
  const [workflow, observability] = await Promise.all([
    readFile(
      new URL("../.github/workflows/validate.yml", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/lib/observability.ts", import.meta.url), "utf8"),
  ]);

  assert.match(workflow, /MATSURI_RELEASE: \$\{\{ github\.sha \}\}/);
  assert.match(observability, /release: getReleaseContext\(\)\.release/);
});

test("pins the structured-data script to the enforced CSP hash", async () => {
  const index = await readFile(
    new URL("../index.html", import.meta.url),
    "utf8",
  );
  const headers = await readFile(
    new URL("../public/_headers", import.meta.url),
    "utf8",
  );
  const body = index.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  )?.[1];
  assert.ok(body);
  const hash = createHash("sha256").update(body).digest("base64");
  assert.ok(headers.includes(`'sha256-${hash}'`));
  const routePreloadHash = createHash("sha256")
    .update(STOREFRONT_ROUTE_PRELOAD_SCRIPT)
    .digest("base64");
  assert.ok(headers.includes(`'sha256-${routePreloadHash}'`));
  assert.doesNotMatch(
    index,
    /<script(?![^>]+\bsrc=)(?![^>]+application\/ld\+json)/i,
  );
});

test("keeps the static and function security-header contracts aligned", async () => {
  const [headers, mediaRoute, functionRoutes] = await Promise.all([
    readFile(new URL("../public/_headers", import.meta.url), "utf8"),
    readFile(new URL("../functions/media-route.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/_routes.json", import.meta.url), "utf8"),
  ]);

  for (const source of [headers, mediaRoute]) {
    assert.match(source, /max-age=31536000/);
    assert.doesNotMatch(source, /includeSubDomains|preload/i);
  }
  const staticPolicy = headers.match(/Content-Security-Policy: ([^\n]+)/)?.[1];
  const functionPolicy = mediaRoute.match(
    /const CONTENT_SECURITY_POLICY =\n\s+"([^"]+)";/,
  )?.[1];
  assert.ok(staticPolicy);
  assert.match(
    staticPolicy,
    /frame-src 'self' https:\/\/challenges\.cloudflare\.com/,
  );
  assert.match(
    staticPolicy,
    /script-src[^;]+https:\/\/static\.cloudflareinsights\.com/,
  );
  assert.match(staticPolicy, /connect-src 'self'/);
  assert.equal(functionPolicy, staticPolicy);
  assert.deepEqual(JSON.parse(functionRoutes), {
    version: 1,
    include: ["/gacha-simulator/videos/*", "/hsr-simulator/videos/*"],
    exclude: [],
  });
});

test("gates the serialized production deploy on the current main SHA", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/validate.yml", import.meta.url),
    "utf8",
  );
  const freshness = workflow.indexOf("Confirm release is still current main");
  const deployment = workflow.indexOf("Deploy to Cloudflare Pages");

  assert.ok(freshness >= 0);
  assert.ok(deployment > freshness);
  assert.match(workflow, /github\.rest\.git\.getRef/);
  assert.match(workflow, /mainSha === context\.sha/);
  assert.match(
    workflow,
    /if: steps\.release-freshness\.outputs\.current == 'true'/,
  );
  assert.match(workflow, /group: matsuri-\$\{\{ github\.workflow \}\}-checks-/);
  assert.match(
    workflow,
    /group: matsuri-\$\{\{ github\.workflow \}\}-database-/,
  );
  assert.match(workflow, /group: matsuri-\$\{\{ github\.workflow \}\}-e2e-/);
  assert.match(workflow, /group: matsuri-cloudflare-production/);
  assert.match(workflow, /MATSURI_ROLLBACK_COMPATIBILITY: "true"/);
  assert.match(workflow, /VITE_SUPABASE_ANON_KEY VITE_TURNSTILE_SITE_KEY; do/);
  assert.doesNotMatch(workflow, /VITE_TURNSTILE_SITE_KEY VITE_SENTRY_DSN; do/);
  assert.match(
    workflow,
    /VITE_SENTRY_DSN is not configured; browser observability will report disabled/,
  );
  assert.match(workflow, /npm run validate:observability -- --production/);
  assert.match(
    workflow,
    /steps\.deployment\.outcome == 'success' && \(steps\.verify-deployment\.outcome == 'failure'/,
  );
  assert.match(workflow, /Verify active release after upload failure/);
  assert.match(workflow, /Smoke active production after upload failure/);
  const rollbackStep = workflow.slice(
    workflow.indexOf("Roll back failed production release"),
    workflow.indexOf("Verify rollback became active"),
  );
  assert.doesNotMatch(rollbackStep, /steps\.deployment\.outcome == 'failure'/);
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
    if (
      String(url).includes("/functions/v1/create-order") &&
      (init.method ?? "GET") === "POST"
    ) {
      return new Response(null, { status: 403 });
    }
    if (String(url).includes("/functions/v1/create-order")) {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "https://matsuri.pro",
          "x-matsuri-checkout-contract": CHECKOUT_CONTRACT_VERSION,
        },
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
  assert.equal(result.checks, 10);
  assert.equal(
    requests.at(-1).url,
    "https://project.supabase.co/functions/v1/create-order",
  );
  assert.equal(requests.at(-1).method, "POST");
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
    3,
  );
  const checkoutRequests = requests.filter((request) =>
    request.url.endsWith("/functions/v1/create-order"),
  );
  assert.equal(checkoutRequests.length, 3);
  assert.equal(
    JSON.parse(checkoutRequests.at(-1).body).turnstileToken,
    "production-smoke-invalid-token",
  );
});

test("smoke rejects a stale create-order contract", async () => {
  const fetchImpl = async (url, init = {}) => {
    if (String(url).includes("/rest/v1/rpc/get_storefront_bootstrap")) {
      return new Response(JSON.stringify(validStorefrontBootstrap()), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (String(url).includes("/functions/v1/create-order")) {
      return new Response(null, {
        status: init.method === "OPTIONS" ? 204 : 403,
        headers: {
          "access-control-allow-origin": "https://matsuri.pro",
          "x-matsuri-checkout-contract": "stale-contract",
        },
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

  await assert.rejects(
    smokeProduction({
      baseUrl: "https://matsuri.pro",
      supabaseUrl: "https://project.supabase.co",
      supabaseAnonKey: "public-anon-key",
      fetchImpl,
    }),
    new Error(
      `checkout preflight contract stale-contract, expected ${CHECKOUT_CONTRACT_VERSION}`,
    ),
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
