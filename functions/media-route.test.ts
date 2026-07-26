import { describe, expect, it } from "vitest";
import {
  getSimulatorMediaKey,
  getSimulatorMediaRange,
  isSimulatorMediaPath,
} from "./media-route";

describe("simulator media route", () => {
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
});
