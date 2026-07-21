import { describe, expect, it } from "vitest";
import { getRoutePrefetchTarget } from "../routePrefetch";

describe("route prefetch targeting", () => {
  it("prefetches the catalog only for the storefront route", () => {
    expect(getRoutePrefetchTarget("/s/artist-shop", "/")).toBe("catalog");
    expect(getRoutePrefetchTarget("/s/artist-shop/", "/")).toBe("catalog");
    expect(getRoutePrefetchTarget("/s/artist-shop/play", "/")).toBeNull();
  });

  it("handles deployments under a base path", () => {
    expect(getRoutePrefetchTarget("/matsuri/s/artist-shop", "/matsuri/"))
      .toBe("catalog");
    expect(getRoutePrefetchTarget("/matsuri/s/artist-shop/play", "/matsuri/"))
      .toBeNull();
  });
});
