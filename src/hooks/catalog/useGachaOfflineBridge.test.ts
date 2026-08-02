import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GachaLaunchData } from "../../lib/gacha/gachaLaunch";
import type { GachaCatalog } from "../../types/gacha";
import { useGachaOfflineBridge } from "./useGachaOfflineBridge";

const mocks = vi.hoisted(() => ({
  hasPack: vi.fn(),
  downloadPack: vi.fn(),
  downloadPacks: vi.fn(),
  catalogUrls: vi.fn(() => ["https://example.com/item.webp"]),
}));

vi.mock("../../lib/offline/offlinePack", () => ({
  hasGachaOfflinePack: mocks.hasPack,
  downloadGachaOfflinePack: mocks.downloadPack,
  downloadGachaOfflinePacks: mocks.downloadPacks,
  gachaCatalogOfflineUrls: mocks.catalogUrls,
  offlinePackPercent: () => 50,
}));

const catalog = {
  settings: {},
  banners: [],
  entries: [],
} as unknown as GachaCatalog;
const launch = {
  shop: { id: "shop-1", slug: "demo", name: "Demo" },
  booth: {},
  catalogs: { genshin: catalog, hsr: catalog },
} as unknown as GachaLaunchData;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasPack.mockResolvedValue(false);
  mocks.downloadPacks.mockResolvedValue(undefined);
});

describe("useGachaOfflineBridge", () => {
  it("marks the selector ready when every available pack is cached", async () => {
    mocks.hasPack.mockResolvedValue(true);
    const { result } = renderHook(() =>
      useGachaOfflineBridge({
        launch,
        activeGame: null,
        activeCatalog: null,
        availableGames: ["genshin", "hsr"],
        loadErrorMessage: "Could not save the game.",
      }),
    );

    await waitFor(() => expect(result.current.packDownload.status).toBe("ready"));
    expect(mocks.hasPack).toHaveBeenCalledTimes(2);
  });

  it("owns multi-game download progress and completion", async () => {
    mocks.downloadPacks.mockImplementation(
      async (_games, _images, onProgress) => {
        onProgress({ gameType: "hsr", percent: 40 });
      },
    );
    const { result } = renderHook(() =>
      useGachaOfflineBridge({
        launch,
        activeGame: null,
        activeCatalog: null,
        availableGames: ["genshin", "hsr"],
        loadErrorMessage: "Could not save the game.",
      }),
    );

    await act(() => result.current.saveAvailableGames());

    expect(mocks.downloadPacks).toHaveBeenCalledOnce();
    expect(result.current.packDownload).toEqual({
      status: "ready",
      progress: 100,
    });
  });
});
