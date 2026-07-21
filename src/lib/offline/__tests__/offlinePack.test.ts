import { afterEach, describe, expect, it, vi } from "vitest";
import {
  downloadGachaOfflinePack,
  downloadGachaOfflinePacks,
  hasGachaOfflinePack,
  offlinePackPercent,
} from "../offlinePack";

vi.mock("../pwa", () => ({
  ensureOfflineNavigationReady: vi.fn().mockResolvedValue(undefined),
}));

const manifests = {
  genshin: {
    version: 2,
    packs: {
      genshin: {
        id: "genshin-build-1",
        assets: [
          { path: "/gacha-simulator/index.html", size: 100 },
          { path: "/gacha-simulator/app.js", size: 200 },
        ],
      },
      hsr: {
        id: "hsr-build-1",
        assets: [
          { path: "/hsr-simulator/index.html", size: 100 },
          { path: "/hsr-simulator/icon.png", size: 50 },
        ],
      },
    },
  },
};

function marker(game: "genshin" | "hsr", id: string, paths: string[]) {
  localStorage.setItem(
    `matsuri-offline-pack-v3:${game}`,
    JSON.stringify({
      version: 3,
      manifestVersion: 2,
      packId: id,
      required: paths.map((path) => ({
        url: `http://localhost:3000${path}`,
        cacheName: path.endsWith(".png")
          ? "gacha-static-cache-v1"
          : "gacha-app-shell-v3",
      })),
    }),
  );
}

function installCaches(entries: Record<string, string[]> = {}) {
  const deleted: string[] = [];
  const stored = new Map(
    Object.entries(entries).map(([name, urls]) => [name, new Set(urls)]),
  );
  const open = vi.fn(async (name: string) => {
    let urls = stored.get(name);
    if (!urls) {
      urls = new Set();
      stored.set(name, urls);
    }
    return {
      match: vi.fn(async (request: RequestInfo | URL) => {
        const url = request instanceof Request ? request.url : String(request);
        return urls?.has(url) ? new Response("cached") : undefined;
      }),
      put: vi.fn(async (request: RequestInfo | URL) => {
        const url = request instanceof Request ? request.url : String(request);
        urls?.add(url);
      }),
      delete: vi.fn(async (request: RequestInfo | URL) => {
        const url = request instanceof Request ? request.url : String(request);
        deleted.push(url);
        return urls?.delete(url) ?? false;
      }),
    };
  });
  vi.stubGlobal("caches", { open });
  return { deleted, open, stored };
}

function mockManifest(manifest = manifests.genshin) {
  return vi.fn(async (request: RequestInfo | URL) => {
    const url = request instanceof Request ? request.url : String(request);
    if (url.endsWith("/offline-assets.json"))
      return new Response(JSON.stringify(manifest), { status: 200 });
    return new Response("asset", { status: 200 });
  });
}

describe("offline gacha pack readiness", () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, "storage");
  });

  it("shows visible progress as soon as the first file finishes", () => {
    expect(offlinePackPercent({ completed: 0, total: 1_072 })).toBe(0);
    expect(offlinePackPercent({ completed: 1, total: 1_072 })).toBe(1);
    expect(offlinePackPercent({ completed: 1_072, total: 1_072 })).toBe(100);
  });

  it("accepts a matching marker only when every required asset is cached", async () => {
    installCaches({
      "gacha-app-shell-v3": [
        "http://localhost:3000/hsr-simulator/index.html",
      ],
      "gacha-static-cache-v1": [
        "http://localhost:3000/hsr-simulator/icon.png",
      ],
    });
    vi.stubGlobal("fetch", mockManifest());
    marker("hsr", "hsr-build-1", [
      "/hsr-simulator/index.html",
      "/hsr-simulator/icon.png",
    ]);

    await expect(hasGachaOfflinePack("hsr")).resolves.toBe(true);
  });

  it("removes a marker for a partial cache even when index.html remains", async () => {
    installCaches({
      "gacha-app-shell-v3": [
        "http://localhost:3000/gacha-simulator/index.html",
      ],
    });
    vi.stubGlobal("fetch", mockManifest());
    marker("genshin", "genshin-build-1", [
      "/gacha-simulator/index.html",
      "/gacha-simulator/app.js",
    ]);

    await expect(hasGachaOfflinePack("genshin")).resolves.toBe(false);
    expect(localStorage.getItem("matsuri-offline-pack-v3:genshin")).toBeNull();
  });

  it("invalidates a complete cache from an older simulator build", async () => {
    const cacheState = installCaches({
      "gacha-app-shell-v3": [
        "http://localhost:3000/gacha-simulator/index.html",
        "http://localhost:3000/gacha-simulator/app.js",
      ],
    });
    vi.stubGlobal("fetch", mockManifest());
    marker("genshin", "older-build", [
      "/gacha-simulator/index.html",
      "/gacha-simulator/app.js",
    ]);

    await expect(hasGachaOfflinePack("genshin")).resolves.toBe(false);
    expect(cacheState.deleted).toEqual([
      "http://localhost:3000/gacha-simulator/index.html",
      "http://localhost:3000/gacha-simulator/app.js",
    ]);
    expect(localStorage.getItem("matsuri-offline-pack-v3:genshin")).toBeNull();
  });

  it("redownloads stable asset URLs when the simulator build changes", async () => {
    const cacheState = installCaches({
      "gacha-app-shell-v3": [
        "http://localhost:3000/gacha-simulator/index.html",
        "http://localhost:3000/gacha-simulator/app.js",
      ],
    });
    const fetchMock = mockManifest();
    vi.stubGlobal("fetch", fetchMock);
    marker("genshin", "older-build", [
      "/gacha-simulator/index.html",
      "/gacha-simulator/app.js",
    ]);

    await downloadGachaOfflinePack("genshin");

    expect(cacheState.deleted).toEqual([
      "http://localhost:3000/gacha-simulator/index.html",
      "http://localhost:3000/gacha-simulator/app.js",
    ]);
    expect(
      fetchMock.mock.calls
        .map(([request]) =>
          request instanceof Request ? request.url : String(request),
        )
        .filter((url) => !url.endsWith("/offline-assets.json")),
    ).toEqual([
      "http://localhost:3000/gacha-simulator/index.html",
      "http://localhost:3000/gacha-simulator/app.js",
    ]);
  });

  it("redownloads cached simulator assets when no current marker exists", async () => {
    installCaches({
      "gacha-app-shell-v3": [
        "http://localhost:3000/gacha-simulator/index.html",
        "http://localhost:3000/gacha-simulator/app.js",
      ],
    });
    const fetchMock = mockManifest();
    vi.stubGlobal("fetch", fetchMock);

    await downloadGachaOfflinePack("genshin");

    expect(
      fetchMock.mock.calls
        .map(([request]) =>
          request instanceof Request ? request.url : String(request),
        )
        .filter((url) => !url.endsWith("/offline-assets.json")),
    ).toEqual([
      "http://localhost:3000/gacha-simulator/index.html",
      "http://localhost:3000/gacha-simulator/app.js",
    ]);
  });

  it("continues when storage estimates are unavailable", async () => {
    installCaches();
    vi.stubGlobal("fetch", mockManifest());
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: { estimate: vi.fn().mockRejectedValue(new Error("blocked")) },
    });

    await expect(downloadGachaOfflinePack("genshin")).resolves.toMatchObject({
      completed: 2,
      total: 2,
    });
    expect(localStorage.getItem("matsuri-offline-pack-v3:genshin")).not.toBeNull();
  });

  it("fails before downloading when the estimate cannot fit missing assets", async () => {
    installCaches();
    const fetchMock = mockManifest();
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: {
        estimate: vi.fn().mockResolvedValue({ quota: 250, usage: 100 }),
      },
    });

    await expect(downloadGachaOfflinePack("genshin")).rejects.toThrow(
      /not enough browser storage/i,
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(localStorage.getItem("matsuri-offline-pack-v3:genshin")).toBeNull();
  });

  it("reports one combined completion for two already cached games", async () => {
    installCaches({
      "gacha-app-shell-v3": [
        "http://localhost:3000/gacha-simulator/index.html",
        "http://localhost:3000/gacha-simulator/app.js",
        "http://localhost:3000/hsr-simulator/index.html",
      ],
      "gacha-static-cache-v1": [
        "http://localhost:3000/hsr-simulator/icon.png",
      ],
    });
    vi.stubGlobal("fetch", mockManifest());
    marker("genshin", "genshin-build-1", [
      "/gacha-simulator/index.html",
      "/gacha-simulator/app.js",
    ]);
    marker("hsr", "hsr-build-1", [
      "/hsr-simulator/index.html",
      "/hsr-simulator/icon.png",
    ]);
    const updates: number[] = [];

    await downloadGachaOfflinePacks(["genshin", "hsr"], {}, (progress) => {
      updates.push(progress.percent);
    });

    expect(updates).toEqual([50, 100]);
  });
});
