import { afterEach, describe, expect, it, vi } from "vitest";
import {
  downloadGachaOfflinePacks,
  hasGachaOfflinePack,
  offlinePackPercent,
} from "./offlinePack";

describe("offline gacha pack readiness", () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("shows visible progress as soon as the first file finishes", () => {
    expect(offlinePackPercent({ completed: 0, total: 1_072 })).toBe(0);
    expect(offlinePackPercent({ completed: 1, total: 1_072 })).toBe(1);
    expect(offlinePackPercent({ completed: 1_072, total: 1_072 })).toBe(100);
  });

  it("accepts a marker only when the simulator shell is still cached", async () => {
    const match = vi.fn().mockResolvedValue(new Response("cached"));
    vi.stubGlobal("caches", { open: vi.fn().mockResolvedValue({ match }) });
    localStorage.setItem("matsuri-offline-pack:hsr", "saved");

    await expect(hasGachaOfflinePack("hsr")).resolves.toBe(true);
    expect(match).toHaveBeenCalledWith(
      "http://localhost:3000/hsr-simulator/index.html",
    );
  });

  it("removes a stale marker after cache storage is cleared", async () => {
    vi.stubGlobal("caches", {
      open: vi.fn().mockResolvedValue({ match: vi.fn().mockResolvedValue(undefined) }),
    });
    localStorage.setItem("matsuri-offline-pack:genshin", "saved");

    await expect(hasGachaOfflinePack("genshin")).resolves.toBe(false);
    expect(localStorage.getItem("matsuri-offline-pack:genshin")).toBeNull();
  });

  it("reports one combined completion for two already cached games", async () => {
    vi.stubGlobal("caches", {
      open: vi.fn().mockResolvedValue({
        match: vi.fn().mockResolvedValue(new Response("cached")),
      }),
    });
    localStorage.setItem("matsuri-offline-pack:genshin", "saved");
    localStorage.setItem("matsuri-offline-pack:hsr", "saved");
    const updates: number[] = [];

    await downloadGachaOfflinePacks(["genshin", "hsr"], {}, (progress) => {
      updates.push(progress.percent);
    });

    expect(updates).toEqual([50, 100]);
  });
});
