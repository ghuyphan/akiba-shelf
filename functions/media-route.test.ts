import { describe, expect, it } from "vitest";
import {
  applyFunctionSecurityHeaders,
  FUNCTION_SECURITY_HEADERS,
  getSimulatorMediaKey,
  getSimulatorMediaRange,
  isSimulatorMediaPath,
  parseSimulatorMediaRange,
} from "./media-route";

describe("simulator media route", () => {
  it("applies the shared security baseline without replacing response headers", () => {
    const headers = applyFunctionSecurityHeaders(
      new Headers({ "cache-control": "public, max-age=31536000, immutable" }),
    );

    expect(headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
    for (const [name, value] of Object.entries(FUNCTION_SECURITY_HEADERS)) {
      expect(headers.get(name)).toBe(value);
    }
  });

  it("maps both simulator prefixes to R2 keys", () => {
    expect(
      getSimulatorMediaKey(
        "/gacha-simulator/videos/d4482392614197d5e745/3star-single.mp4",
      ),
    ).toBe("gacha-simulator/videos/d4482392614197d5e745/3star-single.mp4");
    expect(
      getSimulatorMediaKey("/hsr-simulator/videos/legacy-manifest.json"),
    ).toBe("hsr-simulator/videos/legacy-manifest.json");
  });

  it("rejects traversal and encoded path segments", () => {
    expect(isSimulatorMediaPath("/gacha-simulator/videos/../secret.mp4")).toBe(
      true,
    );
    expect(
      getSimulatorMediaKey("/gacha-simulator/videos/../secret.mp4"),
    ).toBeNull();
    expect(
      getSimulatorMediaKey("/gacha-simulator/videos/%2e%2e/secret.mp4"),
    ).toBeNull();
  });

  it("does not claim unrelated paths", () => {
    expect(isSimulatorMediaPath("/assets/app.js")).toBe(false);
    expect(getSimulatorMediaKey("/assets/app.js")).toBeNull();
  });

  it("describes full, explicit, and suffix byte ranges", () => {
    expect(getSimulatorMediaRange(10)).toEqual({ length: 10, status: 200 });
    expect(getSimulatorMediaRange(10, { offset: 0, length: 1 })).toEqual({
      contentRange: "bytes 0-0/10",
      length: 1,
      status: 206,
    });
    expect(getSimulatorMediaRange(10, { suffix: 3 })).toEqual({
      contentRange: "bytes 7-9/10",
      length: 3,
      status: 206,
    });
  });

  it("parses HTTP byte range headers before calling R2", () => {
    expect(parseSimulatorMediaRange("bytes=0-0")).toEqual({
      offset: 0,
      length: 1,
    });
    expect(parseSimulatorMediaRange("bytes=100-")).toEqual({ offset: 100 });
    expect(parseSimulatorMediaRange("bytes=-512")).toEqual({ suffix: 512 });
    expect(parseSimulatorMediaRange("bytes=0-0,2-3")).toEqual({
      offset: 0,
      length: 1,
    });
    expect(parseSimulatorMediaRange("bytes=abc-def")).toBeUndefined();
  });
});
