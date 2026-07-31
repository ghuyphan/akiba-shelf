import { describe, expect, it } from "vitest";
import {
  createStaleAppAssetResponse,
  isJavaScriptResponse,
  isVersionedAppScriptPath,
  STALE_APP_ASSET_HEADER,
  STALE_APP_ASSET_RECOVERY_SCRIPT,
} from "./app-asset-route";

describe("stale application asset recovery", () => {
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
});
