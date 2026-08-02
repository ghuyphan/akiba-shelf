import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultBooth } from "../../constants";

const mocks = vi.hoisted(() => ({ client: null as unknown }));

vi.mock("../shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../shared")>()),
  requireSupabase: () => mocks.client,
}));

import {
  createShop,
  getPublicShop,
  getShopMemberships,
  getShopWorkspaceSummary,
  updateShop,
} from "../shops";

const shop = {
  id: "11000000-0000-4000-8000-000000000001",
  name: "Matsuri Shop",
  slug: "matsuri-shop",
  active: true,
  accepting_orders: true,
  catalog_source_shop_id: null,
};

beforeEach(() => vi.clearAllMocks());

describe("shop API", () => {
  it("normalizes public slugs and validates the shop response", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: shop, error: null }),
    };
    mocks.client = { from: vi.fn(() => query) };

    await expect(getPublicShop("MATSURI-SHOP")).resolves.toEqual(shop);
    expect(query.eq).toHaveBeenNthCalledWith(1, "slug", "matsuri-shop");
    expect(query.eq).toHaveBeenNthCalledWith(2, "active", true);
  });

  it("validates memberships and fills safe workspace branding defaults", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        shop_id: "shop-1",
        shop_name: "Shop One",
        shop_slug: "shop-one",
        booth_name: null,
        logo_url: null,
        theme_background: null,
      },
      error: null,
    });
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            shop_id: "shop-1",
            shop_name: "Shop One",
            shop_slug: "shop-one",
            role: "owner",
            active: true,
            shop_active: true,
          },
        ],
        error: null,
      })
      .mockReturnValueOnce({ single });
    mocks.client = { rpc };

    await expect(getShopMemberships()).resolves.toHaveLength(1);
    await expect(getShopWorkspaceSummary("shop-1")).resolves.toEqual({
      id: "shop-1",
      name: "Shop One",
      slug: "shop-one",
      booth_name: "Shop One",
      logo_url: "",
      theme_background: defaultBooth.theme_background,
    });
  });

  it("uses RPC contracts for shop creation and trimmed updates", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: shop, error: null })
      .mockResolvedValueOnce({ error: null });
    mocks.client = { rpc };

    await expect(createShop("Matsuri Shop", "matsuri-shop")).resolves.toEqual(
      shop,
    );
    await updateShop(shop.id, "  Updated Shop  ");

    expect(rpc).toHaveBeenNthCalledWith(1, "create_shop", {
      p_name: "Matsuri Shop",
      p_slug: "matsuri-shop",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "update_shop_details", {
      p_shop_id: shop.id,
      p_name: "Updated Shop",
    });
  });
});
