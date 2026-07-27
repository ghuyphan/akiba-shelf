import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCloudflareApiResponse,
  waitForPagesDeployment,
} from "./cloudflare-pages-api.mjs";
import { verifyCloudflareDeployment } from "./verify-cloudflare-deployment.mjs";

const oldHtml =
  '<script type="module" src="/assets/index-old12345.js"></script>';
const currentHtml =
  '<!doctype html><script type="module" src="/assets/index-new12345.js"></script>';

function htmlResponse(html) {
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
      "content-security-policy": "default-src 'self'",
    },
  });
}

function releaseResponse(release) {
  return Response.json(
    { version: 1, release, entryAsset: "/assets/index-new12345.js" },
    { headers: { "cache-control": "no-cache, no-store, must-revalidate" } },
  );
}

function offlineManifestResponse() {
  return Response.json({
    version: 2,
    packs: {
      genshin: {
        id: "pack-1",
        assets: [
          {
            path: "/gacha-simulator/videos/0123456789abcdef0123/bg.webm",
            size: 10,
          },
        ],
      },
    },
  });
}

function simulatorMediaResponse() {
  return new Response(new Uint8Array([0]), {
    status: 206,
    headers: {
      "content-type": "video/webm",
      "content-range": "bytes 0-0/10",
    },
  });
}

test("waits for the canonical domain and verifies the www redirect", async () => {
  let canonicalRequests = 0;
  const requestedUrls = [];
  const fetchImpl = async (url) => {
    requestedUrls.push(url);
    if (url === "https://deploy.pages.dev/release.json")
      return releaseResponse("release-1");
    if (url === "https://deploy.pages.dev/") return htmlResponse(currentHtml);
    if (url === "https://deploy.pages.dev/auth")
      return htmlResponse(currentHtml);
    if (url === "https://deploy.pages.dev/assets/index-new12345.js")
      return new Response("export {};", {
        headers: { "content-type": "application/javascript" },
      });
    if (url === "https://matsuri.pro/") {
      canonicalRequests += 1;
      return htmlResponse(canonicalRequests === 1 ? oldHtml : currentHtml);
    }
    if (url === "https://matsuri.pro/release.json")
      return releaseResponse("release-1");
    if (url === "https://matsuri.pro/assets/index-new12345.js")
      return new Response("export {};", {
        headers: { "content-type": "application/javascript" },
      });
    if (url === "https://matsuri.pro/offline-assets.json")
      return offlineManifestResponse();
    if (
      url ===
      "https://matsuri.pro/gacha-simulator/videos/0123456789abcdef0123/bg.webm"
    )
      return simulatorMediaResponse();
    if (
      url === "https://www.matsuri.pro/__deployment-check?source=github-actions"
    ) {
      return new Response(null, {
        status: 301,
        headers: {
          location:
            "https://matsuri.pro/__deployment-check?source=github-actions",
        },
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const result = await verifyCloudflareDeployment({
    deploymentUrl: "https://deploy.pages.dev",
    canonicalUrl: "https://matsuri.pro",
    wwwUrl: "https://www.matsuri.pro",
    attempts: 2,
    delayMs: 0,
    fetchImpl,
    sleep: async () => undefined,
  });

  assert.equal(result.entryAsset, "/assets/index-new12345.js");
  assert.equal(result.release, "release-1");
  assert.equal(canonicalRequests, 2);
  assert.deepEqual(requestedUrls, [
    "https://deploy.pages.dev/release.json",
    "https://deploy.pages.dev/",
    "https://deploy.pages.dev/auth",
    "https://deploy.pages.dev/assets/index-new12345.js",
    "https://matsuri.pro/release.json",
    "https://matsuri.pro/",
    "https://matsuri.pro/",
    "https://matsuri.pro/assets/index-new12345.js",
    "https://matsuri.pro/offline-assets.json",
    "https://matsuri.pro/gacha-simulator/videos/0123456789abcdef0123/bg.webm",
    "https://www.matsuri.pro/__deployment-check?source=github-actions",
  ]);
});

test("allows canonical hashed assets to outlast the normal retry budget", async () => {
  let canonicalAssetRequests = 0;
  const fetchImpl = async (url) => {
    if (url === "https://deploy.pages.dev/release.json")
      return releaseResponse("release-1");
    if (url === "https://deploy.pages.dev/") return htmlResponse(currentHtml);
    if (url === "https://deploy.pages.dev/auth")
      return htmlResponse(currentHtml);
    if (url === "https://deploy.pages.dev/assets/index-new12345.js")
      return new Response("export {};", {
        headers: { "content-type": "application/javascript" },
      });
    if (url === "https://matsuri.pro/release.json")
      return releaseResponse("release-1");
    if (url === "https://matsuri.pro/") return htmlResponse(currentHtml);
    if (url === "https://matsuri.pro/offline-assets.json")
      return offlineManifestResponse();
    if (
      url ===
      "https://matsuri.pro/gacha-simulator/videos/0123456789abcdef0123/bg.webm"
    )
      return simulatorMediaResponse();
    if (url === "https://matsuri.pro/assets/index-new12345.js") {
      canonicalAssetRequests += 1;
      return canonicalAssetRequests <= 10
        ? htmlResponse(currentHtml)
        : new Response("export {};", {
            headers: { "content-type": "application/javascript" },
          });
    }
    if (
      url === "https://www.matsuri.pro/__deployment-check?source=github-actions"
    ) {
      return new Response(null, {
        status: 301,
        headers: {
          location:
            "https://matsuri.pro/__deployment-check?source=github-actions",
        },
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  await verifyCloudflareDeployment({
    deploymentUrl: "https://deploy.pages.dev",
    canonicalUrl: "https://matsuri.pro",
    wwwUrl: "https://www.matsuri.pro",
    attempts: 1,
    canonicalAttempts: 12,
    delayMs: 0,
    fetchImpl,
    sleep: async () => undefined,
  });

  assert.equal(canonicalAssetRequests, 11);
});

test("rejects non-HTTPS deployment origins", async () => {
  await assert.rejects(
    verifyCloudflareDeployment({
      deploymentUrl: "http://deploy.pages.dev",
      canonicalUrl: "https://matsuri.pro",
      wwwUrl: "https://www.matsuri.pro",
      attempts: 1,
    }),
    /Deployment URL must use HTTPS/,
  );
});

test("rejects unsuccessful Cloudflare API envelopes", () => {
  assert.throws(
    () =>
      parseCloudflareApiResponse(
        { success: false, errors: [{ message: "rollback denied" }] },
        "rollback",
      ),
    /rollback failed: rollback denied/,
  );
});

test("waits until the requested Pages deployment is active", async () => {
  const ids = ["failed-release", "previous-release"];
  const authorizations = [];
  const deployment = await waitForPagesDeployment({
    accountId: "account-1",
    apiToken: "token-1",
    projectName: "matsuri",
    deploymentId: "previous-release",
    attempts: 2,
    delayMs: 0,
    sleep: async () => undefined,
    fetchImpl: async (_url, init) => {
      authorizations.push(init.headers.Authorization);
      return Response.json({ success: true, result: [{ id: ids.shift() }] });
    },
  });

  assert.equal(deployment.id, "previous-release");
  assert.deepEqual(authorizations, ["Bearer token-1", "Bearer token-1"]);
});
