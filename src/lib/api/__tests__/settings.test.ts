import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultBooth } from "../../constants";
import { saveBoothSettings } from "../settings";

const mocks = vi.hoisted(() => ({ client: null as unknown }));

vi.mock("../shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../shared")>()),
  requireSupabase: () => mocks.client,
}));

function boothClient(removeError: Error | null) {
  const previous = {
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        logo_path: "shop/old-logo.webp",
        social_qr_logo_path: "shop/old-social.webp",
      },
      error: null,
    }),
  };
  const write = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { ...defaultBooth, id: "shop-1", shop_id: "shop-1" },
      error: null,
    }),
  };
  const remove = vi.fn().mockResolvedValue({ error: removeError });
  mocks.client = {
    rpc: vi.fn().mockReturnValue(previous),
    from: vi.fn().mockReturnValue(write),
    storage: { from: vi.fn().mockReturnValue({ remove }) },
  };
  return { remove };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("booth settings saving", () => {
  it("rejects malformed theme colors before making a request", async () => {
    await expect(
      saveBoothSettings("shop-1", {
        ...defaultBooth,
        theme_primary: "not-a-color",
      }),
    ).rejects.toThrow("Use a 6 digit hex color");
  });

  it("reports cleanup separately after the booth save commits", async () => {
    const { remove } = boothClient(new Error("Storage unavailable"));

    await expect(
      saveBoothSettings("shop-1", {
        ...defaultBooth,
        shop_id: "shop-1",
        logo_path: "shop/new-logo.webp",
        social_qr_logo_path: "shop/new-social.webp",
      }),
    ).resolves.toEqual({
      booth: expect.objectContaining({ shop_id: "shop-1" }),
      imageCleanupPending: true,
    });
    expect(remove).toHaveBeenCalledWith([
      "shop/old-logo.webp",
      "shop/old-social.webp",
    ]);
  });

  it("reports a fully completed save when cleanup succeeds", async () => {
    boothClient(null);

    await expect(
      saveBoothSettings("shop-1", {
        ...defaultBooth,
        shop_id: "shop-1",
        logo_path: "shop/new-logo.webp",
        social_qr_logo_path: "shop/new-social.webp",
      }),
    ).resolves.toEqual({
      booth: expect.objectContaining({ shop_id: "shop-1" }),
      imageCleanupPending: false,
    });
  });
});
