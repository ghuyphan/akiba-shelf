import { describe, expect, it, vi } from "vitest";
import { getAppUrl, restoreRedirect } from "../authUrls";

describe("Application URL generation and redirect restoration", () => {
  describe("getAppUrl", () => {
    it("generates correct local/production URL based on origin and BASE_URL", () => {
      vi.stubGlobal("location", {
        origin: "https://matsuri.pro",
      });

      expect(getAppUrl("/auth/callback")).toBe("https://matsuri.pro/auth/callback");
      expect(getAppUrl("auth/set-password")).toBe("https://matsuri.pro/auth/set-password");

      vi.unstubAllGlobals();
    });

    it("works correctly on localhost", () => {
      vi.stubGlobal("location", {
        origin: "http://127.0.0.1:5173",
      });

      expect(getAppUrl("/auth/callback")).toBe("http://127.0.0.1:5173/auth/callback");

      vi.unstubAllGlobals();
    });
  });

  describe("restoreRedirect", () => {
    it.each([
      "/dashboard",
      "/dashboard/shops/new",
      "/auth/callback?code=x#token",
      "/auth/set-password#access_token=x",
      "/s/test-shop",
    ])("restores relative redirect target %s under root base", (target) => {
      const replace = vi.spyOn(history, "replaceState");
      const location = new URL(
        `https://matsuri.pro/?redirect=${encodeURIComponent(target)}`,
      ) as unknown as Location;
      expect(restoreRedirect(location, "/")).toBe(true);
      expect(replace.mock.calls.at(-1)?.[2]).toBe(target);
      replace.mockRestore();
    });

    it.each([
      "https://evil.test/x",
      "//evil.test/x",
      "javascript:alert(1)",
    ])("rejects unsafe redirect target %s", (target) => {
      const replace = vi.spyOn(history, "replaceState");
      const location = new URL(
        `https://matsuri.pro/?redirect=${encodeURIComponent(target)}`,
      ) as unknown as Location;
      expect(restoreRedirect(location, "/")).toBe(false);
      expect(replace.mock.calls.at(-1)?.[2]).toBe("/");
      replace.mockRestore();
    });

    it("preserves query parameters and hash fragments", () => {
      const replace = vi.spyOn(history, "replaceState");
      const target = "/auth/callback?code=123&state=abc#access_token=xyz";
      const location = new URL(
        `https://matsuri.pro/?redirect=${encodeURIComponent(target)}`,
      ) as unknown as Location;
      expect(restoreRedirect(location, "/")).toBe(true);
      expect(replace.mock.calls.at(-1)?.[2]).toBe(target);
      replace.mockRestore();
    });

    it("does not duplicate when base path is provided", () => {
      const replace = vi.spyOn(history, "replaceState");
      const location = new URL(
        "https://example.test/preview/?redirect=%2Fpreview%2Fs%2Fshop",
      ) as unknown as Location;
      expect(restoreRedirect(location, "/preview/")).toBe(true);
      expect(replace.mock.calls.at(-1)?.[2]).toBe("/preview/s/shop");
      replace.mockRestore();
    });
  });
});
