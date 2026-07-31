import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createStaleAppAssetResponse,
  isJavaScriptResponse,
  isVersionedAppScriptPath,
  STALE_APP_ASSET_HEADER,
  STALE_APP_ASSET_RECOVERY_SCRIPT,
} from "./app-asset-route";
import { onRequest } from "./[[path]]";

function createAssetContext(
  assetResponse: Response,
  requestUrl = "https://deploy.matsuri-88f.pages.dev/assets/index-BPGrAREH.js",
) {
  const assetFetch = vi.fn().mockResolvedValue(assetResponse);
  const next = vi.fn().mockResolvedValue(
    new Response("<!doctype html>", {
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
  );
  const context = {
    request: new Request(requestUrl, {
      headers: { accept: "text/javascript", cookie: "session=private" },
    }),
    env: { ASSETS: { fetch: assetFetch } },
    next,
  } as unknown as Parameters<typeof onRequest>[0];
  return { assetFetch, context, next };
}

describe("stale application asset recovery", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("recognizes only versioned application scripts", () => {
    expect(isVersionedAppScriptPath("/assets/index-BPGrAREH.js")).toBe(true);
    expect(isVersionedAppScriptPath("/assets/AdminPage-a1_b2C3d.js")).toBe(
      true,
    );
    expect(isVersionedAppScriptPath("/assets/index.js")).toBe(false);
    expect(isVersionedAppScriptPath("/assets/index-BPGrAREH.css")).toBe(false);
    expect(
      isVersionedAppScriptPath("/gacha-simulator/assets/index-Xy123456.js"),
    ).toBe(false);
  });

  it("accepts JavaScript assets and rejects the Pages HTML fallback", () => {
    expect(
      isJavaScriptResponse(
        new Response("export {};", {
          headers: { "content-type": "application/javascript" },
        }),
      ),
    ).toBe(true);
    expect(
      isJavaScriptResponse(
        new Response("<!doctype html>", {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      ),
    ).toBe(false);
  });

  it("returns an uncached JavaScript recovery module with security headers", async () => {
    const response = createStaleAppAssetResponse("GET");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("javascript");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get(STALE_APP_ASSET_HEADER)).toBe("recover");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.text()).toBe(STALE_APP_ASSET_RECOVERY_SCRIPT);
    expect(STALE_APP_ASSET_RECOVERY_SCRIPT).toContain("registration.update()");
    expect(STALE_APP_ASSET_RECOVERY_SCRIPT).toContain("location.reload()");
    expect(
      STALE_APP_ASSET_RECOVERY_SCRIPT.indexOf("registration.update()"),
    ).toBeLessThan(STALE_APP_ASSET_RECOVERY_SCRIPT.indexOf("caches.keys()"));
  });

  it("omits the recovery body for HEAD requests", async () => {
    const response = createStaleAppAssetResponse("HEAD");
    expect(await response.text()).toBe("");
  });

  it("reads deployment application scripts from the asset binding", async () => {
    const assetResponse = new Response("export {};", {
      headers: { "content-type": "application/javascript" },
    });
    const { assetFetch, context, next } = createAssetContext(assetResponse);

    const response = await onRequest(context);

    expect(response).toBe(assetResponse);
    expect(assetFetch).toHaveBeenCalledWith(context.request);
    expect(next).not.toHaveBeenCalled();
  });

  it("reads custom-domain scripts from the stable Pages project origin", async () => {
    const projectResponse = new Response("export {};", {
      headers: { "content-type": "application/javascript" },
    });
    const projectFetch = vi.fn().mockResolvedValue(projectResponse);
    vi.stubGlobal("fetch", projectFetch);
    const { assetFetch, context, next } = createAssetContext(
      new Response("deployment fallback"),
      "https://matsuri.pro/assets/index-BPGrAREH.js?cache=1",
    );

    const response = await onRequest(context);

    expect(response).toBe(projectResponse);
    expect(projectFetch).toHaveBeenCalledOnce();
    const request = projectFetch.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe(
      "https://matsuri-88f.pages.dev/assets/index-BPGrAREH.js?cache=1",
    );
    expect(request.headers.get("accept")).toBe("text/javascript");
    expect(request.headers.has("cookie")).toBe(false);
    expect(assetFetch).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("falls back to the deployment binding when the project origin misses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<!doctype html>", {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      ),
    );
    const assetResponse = new Response("export {};", {
      headers: { "content-type": "application/javascript" },
    });
    const { assetFetch, context } = createAssetContext(
      assetResponse,
      "https://matsuri.pro/assets/index-BPGrAREH.js",
    );

    const response = await onRequest(context);

    expect(response).toBe(assetResponse);
    expect(assetFetch).toHaveBeenCalledWith(context.request);
  });

  it("recovers when both application asset lookups return the SPA shell", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<!doctype html>", {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      ),
    );
    const { context, next } = createAssetContext(
      new Response("<!doctype html>", {
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
      "https://matsuri.pro/assets/index-BPGrAREH.js",
    );

    const response = await onRequest(context);

    expect(response.headers.get(STALE_APP_ASSET_HEADER)).toBe("recover");
    expect(next).not.toHaveBeenCalled();
  });
});
