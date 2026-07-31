import { pathToFileURL } from "node:url";

const DEFAULT_ATTEMPTS = 10;
const DEFAULT_DEPLOYMENT_ATTEMPTS = 40;
const DEFAULT_CANONICAL_ATTEMPTS = 40;
const DEFAULT_DELAY_MS = 3_000;
const REQUEST_TIMEOUT_MS = 15_000;
const deploymentCheckPath = "/__deployment-check?source=github-actions";
const staleAppAssetPath = "/assets/index-Missing0.js";
const EXPECTED_HSTS = "max-age=31536000";

function verifySecurityHeaders(response) {
  if (response.headers.get("x-content-type-options") !== "nosniff") {
    throw new Error("missing X-Content-Type-Options: nosniff");
  }
  if (
    response.headers.get("referrer-policy") !==
    "strict-origin-when-cross-origin"
  ) {
    throw new Error("missing Referrer-Policy security header");
  }
  if (!response.headers.get("content-security-policy")) {
    throw new Error("missing enforced Content-Security-Policy header");
  }
  if (response.headers.get("strict-transport-security") !== EXPECTED_HSTS) {
    throw new Error(`missing Strict-Transport-Security: ${EXPECTED_HSTS}`);
  }
}

function verifyHtmlSecurityHeaders(
  response,
  { requireCloudflareAnalytics = true } = {},
) {
  verifySecurityHeaders(response);
  const policy = response.headers.get("content-security-policy");
  const directives = new Map(
    policy.split(";").map((directive) => {
      const [name, ...sources] = directive.trim().split(/\s+/);
      return [name, sources];
    }),
  );
  if (
    requireCloudflareAnalytics &&
    !directives
      .get("script-src")
      ?.includes("https://static.cloudflareinsights.com")
  ) {
    throw new Error("CSP does not permit the Cloudflare Web Analytics beacon");
  }
  if (!directives.get("connect-src")?.includes("'self'")) {
    throw new Error("CSP does not permit same-origin analytics delivery");
  }
}

function extractSimulatorBootstrap(html, simulatorPath) {
  const bootstrapPath = `/${simulatorPath}/internal/matsuri-bootstrap.js`;
  const escapedPath = bootstrapPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!new RegExp(`<script\\b[^>]*\\bsrc=["']${escapedPath}["']`).test(html)) {
    throw new Error(`Could not find ${simulatorPath} bootstrap asset.`);
  }
  if (
    /<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>\s*\S/i.test(
      html,
    )
  ) {
    throw new Error(
      `${simulatorPath} still contains executable inline script.`,
    );
  }
  return bootstrapPath;
}

function normalizeOrigin(value, label) {
  if (!value) throw new Error(`${label} is required.`);
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error(`${label} must use HTTPS.`);
  }
  return url.origin;
}

function extractEntryAsset(html) {
  const match = html.match(
    /<script\b[^>]*\bsrc=["'](\/assets\/[^"']+\.js)["'][^>]*>/i,
  );
  if (!match) throw new Error("Could not find the application entry asset.");
  return match[1];
}

async function requestWithRetry(
  url,
  validate,
  {
    attempts = DEFAULT_ATTEMPTS,
    delayMs = DEFAULT_DELAY_MS,
    fetchImpl = fetch,
    requestInit = {},
    sleep = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
  } = {},
) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        ...requestInit,
        headers: { accept: "text/html", ...(requestInit.headers ?? {}) },
        redirect: "manual",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      return await validate(response);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(delayMs);
    }
  }

  const detail =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Deployment check failed for ${url}: ${detail}`);
}

async function fetchSimulatorMedia(origin, options) {
  const manifest = await requestWithRetry(
    `${origin}/offline-assets.json`,
    async (response) => {
      if (response.status !== 200)
        throw new Error(`expected HTTP 200, received ${response.status}`);
      const value = await response.json();
      const assets = Object.values(value?.packs ?? {}).flatMap(
        (pack) => pack?.assets ?? [],
      );
      const media = assets.find(
        (asset) =>
          typeof asset?.path === "string" &&
          /^\/(?:gacha-simulator|hsr-simulator)\/videos\/[a-f0-9]{20}\/[A-Za-z0-9._-]+\.(?:mp4|webm)$/.test(
            asset.path,
          ),
      );
      if (!media) throw new Error("offline manifest has no versioned media");
      return media.path;
    },
    {
      ...options,
      requestInit: { headers: { accept: "application/json" } },
    },
  );

  await requestWithRetry(
    new URL(manifest, origin).href,
    async (response) => {
      if (response.status !== 206) {
        throw new Error(`expected HTTP 206, received ${response.status}`);
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.startsWith("video/"))
        throw new Error(
          `expected video, received ${contentType || "no content type"}`,
        );
      if (!/^bytes 0-0\/\d+$/.test(response.headers.get("content-range") ?? ""))
        throw new Error("missing single-byte Content-Range response");
      verifySecurityHeaders(response);
    },
    {
      ...options,
      requestInit: {
        headers: { accept: "video/*", range: "bytes=0-0" },
      },
    },
  );

  await requestWithRetry(
    `${origin}/gacha-simulator/videos/blocked%2Fasset.mp4`,
    async (response) => {
      if (response.status !== 404) {
        throw new Error(`expected HTTP 404, received ${response.status}`);
      }
      verifySecurityHeaders(response);
    },
    options,
  );
  return manifest;
}

async function fetchAppHtml(
  url,
  options,
  htmlSecurityOptions,
  expectedEntryAsset,
) {
  return requestWithRetry(
    url,
    async (response) => {
      if (response.status !== 200) {
        throw new Error(`expected HTTP 200, received ${response.status}`);
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html")) {
        throw new Error(
          `expected HTML, received ${contentType || "no content type"}`,
        );
      }
      verifyHtmlSecurityHeaders(response, htmlSecurityOptions);
      const html = await response.text();
      const entryAsset = extractEntryAsset(html);
      if (expectedEntryAsset && entryAsset !== expectedEntryAsset) {
        throw new Error(
          `expected entry asset ${expectedEntryAsset}, received ${entryAsset}`,
        );
      }
      return entryAsset;
    },
    options,
  );
}

async function fetchRelease(url, options, expectedRelease) {
  return requestWithRetry(
    url,
    async (response) => {
      if (response.status !== 200) {
        throw new Error(`expected HTTP 200, received ${response.status}`);
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(
          `expected JSON, received ${contentType || "no content type"}`,
        );
      }
      const metadata = await response.json();
      if (typeof metadata.release !== "string" || !metadata.release) {
        throw new Error(
          "release metadata did not contain a release identifier",
        );
      }
      if (expectedRelease && metadata.release !== expectedRelease) {
        throw new Error(
          `expected release ${expectedRelease}, received ${metadata.release}`,
        );
      }
      if (
        typeof metadata.entryAsset !== "string" ||
        !/^\/assets\/[A-Za-z0-9._-]+\.js$/.test(metadata.entryAsset)
      ) {
        throw new Error("release metadata did not contain a valid entry asset");
      }
      const cacheControl = response.headers.get("cache-control") ?? "";
      if (!cacheControl.includes("no-store")) {
        throw new Error("release metadata must use Cache-Control: no-store");
      }
      return metadata;
    },
    options,
  );
}

async function fetchEntryAsset(origin, assetPath, options) {
  return requestWithRetry(
    new URL(assetPath, origin).href,
    async (response) => {
      if (response.status !== 200) {
        throw new Error(`expected HTTP 200, received ${response.status}`);
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("javascript")) {
        throw new Error(
          `expected JavaScript, received ${contentType || "no content type"}`,
        );
      }
    },
    options,
  );
}

export async function fetchStaleAppAssetRecovery(origin, options) {
  return requestWithRetry(
    new URL(staleAppAssetPath, origin).href,
    async (response) => {
      if (response.status !== 200) {
        throw new Error(`expected HTTP 200, received ${response.status}`);
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("javascript")) {
        throw new Error(
          `expected JavaScript recovery, received ${contentType || "no content type"}`,
        );
      }
      if (response.headers.get("x-matsuri-stale-asset") !== "recover") {
        throw new Error("missing stale asset recovery header");
      }
      const cacheControl = response.headers.get("cache-control") ?? "";
      if (!cacheControl.includes("no-store")) {
        throw new Error(
          "stale asset recovery must use Cache-Control: no-store",
        );
      }
      verifySecurityHeaders(response);
      const body = await response.text();
      if (
        !body.includes("registration.update()") ||
        !body.includes("location.reload()")
      ) {
        throw new Error("stale asset recovery module is incomplete");
      }
      return staleAppAssetPath;
    },
    {
      ...options,
      requestInit: { headers: { accept: "*/*" } },
    },
  );
}

async function fetchSimulatorApp(
  origin,
  simulatorPath,
  options,
  htmlSecurityOptions,
) {
  const bootstrapPath = await requestWithRetry(
    `${origin}/${simulatorPath}/`,
    async (response) => {
      if (response.status !== 200) {
        throw new Error(`expected HTTP 200, received ${response.status}`);
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html")) {
        throw new Error(
          `expected HTML, received ${contentType || "no content type"}`,
        );
      }
      verifyHtmlSecurityHeaders(response, htmlSecurityOptions);
      return extractSimulatorBootstrap(await response.text(), simulatorPath);
    },
    options,
  );
  await fetchEntryAsset(origin, bootstrapPath, options);
  return bootstrapPath;
}

export async function verifyCloudflareDeployment({
  deploymentUrl,
  canonicalUrl,
  wwwUrl,
  expectedRelease,
  deploymentAttempts,
  canonicalAttempts,
  rollbackCompatibility = false,
  verifyStaleAssetRecovery = false,
  ...options
}) {
  const deploymentOrigin = normalizeOrigin(deploymentUrl, "Deployment URL");
  const canonicalOrigin = normalizeOrigin(canonicalUrl, "Canonical URL");
  const wwwOrigin = normalizeOrigin(wwwUrl, "WWW URL");

  // Wrangler can report completion before every file on the immutable Pages
  // URL is readable. Keep strict checks, but allow that deployment to settle.
  const deploymentOptions = {
    ...options,
    attempts:
      deploymentAttempts ?? options.attempts ?? DEFAULT_DEPLOYMENT_ATTEMPTS,
  };
  const htmlSecurityOptions = {
    requireCloudflareAnalytics: !rollbackCompatibility,
  };
  const metadata = await fetchRelease(
    `${deploymentOrigin}/release.json`,
    deploymentOptions,
    expectedRelease,
  );
  const entryAsset = await fetchAppHtml(
    `${deploymentOrigin}/`,
    deploymentOptions,
    htmlSecurityOptions,
  );
  if (entryAsset !== metadata.entryAsset) {
    throw new Error(
      `release metadata entry ${metadata.entryAsset} did not match HTML ${entryAsset}`,
    );
  }
  await fetchAppHtml(
    `${deploymentOrigin}/auth`,
    deploymentOptions,
    htmlSecurityOptions,
    entryAsset,
  );
  await fetchAppHtml(
    `${deploymentOrigin}/admin`,
    deploymentOptions,
    htmlSecurityOptions,
    entryAsset,
  );
  await fetchEntryAsset(deploymentOrigin, entryAsset, deploymentOptions);

  // Custom-domain routing can briefly expose the new HTML before every edge
  // serves its matching hashed assets. Give that propagation a longer budget
  // while still verifying the exact canonical asset users will request.
  const canonicalOptions = {
    ...options,
    attempts:
      canonicalAttempts ?? options.attempts ?? DEFAULT_CANONICAL_ATTEMPTS,
  };
  await fetchRelease(
    `${canonicalOrigin}/release.json`,
    canonicalOptions,
    metadata.release,
  );
  await fetchAppHtml(
    `${canonicalOrigin}/`,
    canonicalOptions,
    htmlSecurityOptions,
    entryAsset,
  );
  await fetchAppHtml(
    `${canonicalOrigin}/admin`,
    canonicalOptions,
    htmlSecurityOptions,
    entryAsset,
  );
  await fetchEntryAsset(canonicalOrigin, entryAsset, canonicalOptions);
  // Rollback verification must remain compatible with the previous release's
  // contract. Current releases additionally require external simulator bootstraps.
  const simulatorBootstraps = rollbackCompatibility
    ? []
    : await Promise.all([
        fetchSimulatorApp(
          canonicalOrigin,
          "gacha-simulator",
          canonicalOptions,
          htmlSecurityOptions,
        ),
        fetchSimulatorApp(
          canonicalOrigin,
          "hsr-simulator",
          canonicalOptions,
          htmlSecurityOptions,
        ),
      ]);
  const simulatorMedia = await fetchSimulatorMedia(
    canonicalOrigin,
    canonicalOptions,
  );
  const staleAppAssetRecovery =
    rollbackCompatibility || !verifyStaleAssetRecovery
      ? null
      : await fetchStaleAppAssetRecovery(canonicalOrigin, canonicalOptions);

  const wwwCheckUrl = new URL(deploymentCheckPath, wwwOrigin);
  const expectedLocation = new URL(deploymentCheckPath, canonicalOrigin).href;
  await requestWithRetry(
    wwwCheckUrl.href,
    async (response) => {
      if (response.status !== 301) {
        throw new Error(`expected HTTP 301, received ${response.status}`);
      }
      const location = response.headers.get("location");
      if (location !== expectedLocation) {
        throw new Error(
          `expected redirect to ${expectedLocation}, received ${location}`,
        );
      }
    },
    options,
  );

  return {
    deploymentOrigin,
    canonicalOrigin,
    entryAsset,
    release: metadata.release,
    simulatorBootstraps,
    simulatorMedia,
    staleAppAssetRecovery,
  };
}

const isCli =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  const [, , deploymentUrl, canonicalUrl, wwwUrl] = process.argv;
  const result = await verifyCloudflareDeployment({
    deploymentUrl,
    canonicalUrl,
    wwwUrl,
    expectedRelease: process.env.MATSURI_RELEASE,
    rollbackCompatibility:
      process.env.MATSURI_ROLLBACK_COMPATIBILITY === "true",
    verifyStaleAssetRecovery: true,
  });
  console.log(
    `Verified release ${result.release} (${result.entryAsset}) on ${result.deploymentOrigin} and ${result.canonicalOrigin}.`,
  );
}
