import { pathToFileURL } from "node:url";

const REQUEST_TIMEOUT_MS = 15_000;
const staticAssets = [
  "/bank-logos/default.png",
  "/bank-logos/MOMO.png",
  "/brand/vietqr.png",
];

function httpsOrigin(value, label) {
  if (!value) throw new Error(`${label} is required.`);
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`${label} must use HTTPS.`);
  return url.origin;
}

async function expectResponse(fetchImpl, url, init, validate) {
  const response = await fetchImpl(url, {
    ...init,
    redirect: "manual",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  await validate(response);
}

export async function smokeProduction({
  baseUrl,
  supabaseUrl,
  supabaseAnonKey,
  storefrontSlug = "demo-booth",
  fetchImpl = fetch,
}) {
  const origin = httpsOrigin(baseUrl, "Base URL");
  const supabaseOrigin = httpsOrigin(supabaseUrl, "Supabase URL");
  if (!supabaseAnonKey) throw new Error("Supabase anon key is required.");
  const htmlPaths = [
    "/",
    `/s/${encodeURIComponent(storefrontSlug)}`,
    "/auth/callback",
  ];

  for (const path of htmlPaths) {
    await expectResponse(
      fetchImpl,
      new URL(path, origin),
      { headers: { accept: "text/html" } },
      async (response) => {
        if (response.status !== 200) {
          throw new Error(
            `${path} expected HTTP 200, received ${response.status}`,
          );
        }
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("text/html")) {
          throw new Error(
            `${path} expected HTML, received ${contentType || "unknown"}`,
          );
        }
      },
    );
  }

  for (const path of staticAssets) {
    await expectResponse(
      fetchImpl,
      new URL(path, origin),
      {},
      async (response) => {
        if (response.status !== 200) {
          throw new Error(
            `${path} expected HTTP 200, received ${response.status}`,
          );
        }
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.startsWith("image/")) {
          throw new Error(
            `${path} expected an image, received ${contentType || "unknown"}`,
          );
        }
      },
    );
  }

  const bootstrapUrl = new URL(
    "/rest/v1/rpc/get_storefront_bootstrap",
    supabaseOrigin,
  );
  await expectResponse(
    fetchImpl,
    bootstrapUrl,
    {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        authorization: `Bearer ${supabaseAnonKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ p_shop_slug: storefrontSlug }),
    },
    async (response) => {
      if (response.status !== 200) {
        throw new Error(
          `storefront bootstrap expected HTTP 200, received ${response.status}`,
        );
      }
      const payload = await response.json();
      if (
        !payload ||
        typeof payload !== "object" ||
        !payload.shop ||
        !payload.catalog_shop_id ||
        !Array.isArray(payload.products)
      ) {
        throw new Error("storefront bootstrap returned an invalid payload");
      }
    },
  );

  const checkoutUrl = new URL("/functions/v1/create-order", supabaseOrigin);
  await expectResponse(
    fetchImpl,
    checkoutUrl,
    {
      method: "OPTIONS",
      headers: {
        origin,
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization, apikey, content-type",
      },
    },
    async (response) => {
      if (response.status < 200 || response.status >= 300) {
        throw new Error(
          `checkout preflight expected 2xx, received ${response.status}`,
        );
      }
      const allowedOrigin = response.headers.get("access-control-allow-origin");
      if (allowedOrigin !== origin) {
        throw new Error(
          `checkout preflight allowed ${allowedOrigin || "no origin"}, expected ${origin}`,
        );
      }
    },
  );

  return {
    origin,
    supabaseOrigin,
    checks: htmlPaths.length + staticAssets.length + 2,
  };
}

function cliOption(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const isCli =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  const result = await smokeProduction({
    baseUrl: cliOption("--base-url") ?? process.env.MATSURI_BASE_URL,
    supabaseUrl: cliOption("--supabase-url") ?? process.env.VITE_SUPABASE_URL,
    supabaseAnonKey:
      cliOption("--supabase-anon-key") ?? process.env.VITE_SUPABASE_ANON_KEY,
    storefrontSlug:
      cliOption("--storefront-slug") ?? process.env.MATSURI_SMOKE_SHOP_SLUG,
  });
  console.log(
    `Production smoke passed ${result.checks} checks on ${result.origin}.`,
  );
}
