import { describe, expect, it, vi } from "vitest";
import { restoreRedirect } from "./authUrls";

describe("GitHub Pages redirect restoration", () => {
  it.each(["/dashboard", "/dashboard/shops/new", "/auth/callback?code=x#token", "/auth/set-password#access_token=x", "/s/test-shop"])("restores %s", (target) => {
    const replace = vi.spyOn(history, "replaceState");
    const location = new URL(`https://example.test/akiba-shelf/?redirect=${encodeURIComponent(target)}`) as unknown as Location;
    expect(restoreRedirect(location)).toBe(true);
    expect(replace.mock.calls.at(-1)?.[2]).toContain(target.split("#")[0]);
    replace.mockRestore();
  });
  it.each(["https://evil.test/x", "//evil.test/x", "javascript:alert(1)"])("rejects %s", (target) => {
    expect(restoreRedirect(new URL(`https://example.test/?redirect=${encodeURIComponent(target)}`) as unknown as Location)).toBe(false);
  });
});
