import { pathToFileURL } from "node:url";

const DEFAULT_ATTEMPTS = 10;
const DEFAULT_CANONICAL_ATTEMPTS = 40;
const DEFAULT_DELAY_MS = 3_000;
const REQUEST_TIMEOUT_MS = 15_000;
const deploymentCheckPath = "/__deployment-check?source=github-actions";

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
    },
    {
      ...options,
      requestInit: {
        headers: { accept: "video/*", range: "bytes=0-0" },
      },
    },
  );
  return manifest;
}

async function fetchAppHtml(url, options, expectedEntryAsset) {
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

export async function verifyCloudflareDeployment({
  deploymentUrl,
  canonicalUrl,
  wwwUrl,
  expectedRelease,
  canonicalAttempts,
  ...options
}) {
  const deploymentOrigin = normalizeOrigin(deploymentUrl, "Deployment URL");
  const canonicalOrigin = normalizeOrigin(canonicalUrl, "Canonical URL");
  const wwwOrigin = normalizeOrigin(wwwUrl, "WWW URL");

  const metadata = await fetchRelease(
    `${deploymentOrigin}/release.json`,
    options,
    expectedRelease,
  );
  const entryAsset = await fetchAppHtml(`${deploymentOrigin}/`, options);
  if (entryAsset !== metadata.entryAsset) {
    throw new Error(
      `release metadata entry ${metadata.entryAsset} did not match HTML ${entryAsset}`,
    );
  }
  await fetchAppHtml(`${deploymentOrigin}/auth`, options, entryAsset);
  await fetchEntryAsset(deploymentOrigin, entryAsset, options);

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
  await fetchAppHtml(`${canonicalOrigin}/`, canonicalOptions, entryAsset);
  await fetchEntryAsset(canonicalOrigin, entryAsset, canonicalOptions);
  const simulatorMedia = await fetchSimulatorMedia(
    canonicalOrigin,
    canonicalOptions,
  );

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
    simulatorMedia,
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
  });
  console.log(
    `Verified release ${result.release} (${result.entryAsset}) on ${result.deploymentOrigin} and ${result.canonicalOrigin}.`,
  );
}
