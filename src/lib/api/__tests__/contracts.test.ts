import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultBooth } from "../../constants";
import {
  createOrder,
  getCustomerOrder,
  getOrderStatusCounts,
  normalizeProduct,
  publishGachaConfiguration,
} from "../../api";
import {
  loadCatalogSnapshot,
  saveCatalogSnapshot,
} from "../../offline/offline";
import { defaultGachaSettings } from "../../../types/gacha";
import type { CartItem, Product } from "../../../types/catalog";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  invoke: vi.fn(),
  rpc: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("../../supabase", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: mocks.from,
    functions: { invoke: mocks.invoke },
    rpc: mocks.rpc,
  },
}));

const shopId = "11000000-0000-4000-8000-000000000001";
const orderId = "40000000-0000-4000-8000-000000000001";

const product: Product = {
  id: "moon-stand",
  name: "Moon Stand",
  collection: "Night",
  description: "A bright acrylic stand",
  price_vnd: 120000,
  sale_price_vnd: null,
  effective_price_vnd: 120000,
  promotion_eligible: true,
  item_code: "MOON-1",
  quantity_available: 2,
  category: "Acrylic",
  badge: "Limited",
  badge_color: "#5f8d55",
  stock_status: "limited",
  stock_note: "Limited stock",
  images: ["https://example.test/moon.jpg"],
  image_variants: [],
  image_paths: [],
  featured: true,
  sort_order: 1,
  active: true,
};

const orderResponse = {
  id: orderId,
  order_code: "A100",
  customer_name: "Customer",
  total_amount: "120000",
  discount_amount: "0",
  status: "pending",
  created_at: "2026-07-21T00:00:00.000Z",
  updated_at: "2026-07-21T00:00:00.000Z",
  expires_at: "2026-07-21T00:10:00.000Z",
  confirmed_at: null,
  cancelled_at: null,
  expired_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.from.mockReturnValue({ upsert: mocks.upsert });
  mocks.invoke.mockResolvedValue({ data: { sent: 0 }, error: null });
  mocks.upsert.mockResolvedValue({ data: null, error: null });
});

describe("order API contracts", () => {
  it("keeps the create_order request payload and notification boundary stable", async () => {
    const cart: CartItem[] = [{ product, quantity: 2, reward_quantity: 1 }];
    mocks.rpc.mockResolvedValueOnce({ data: [orderResponse], error: null });

    const order = await createOrder(
      "akiba-shelf",
      "  Customer  ",
      cart,
      "client-request-1",
      "recovery-token-1",
    );

    expect(mocks.rpc).toHaveBeenCalledWith("create_order", {
      p_shop_slug: "akiba-shelf",
      p_customer_name: "Customer",
      p_items: [{ product_id: "moon-stand", quantity: 3, reward_quantity: 1 }],
      p_client_request_id: "client-request-1",
      p_recovery_token: "recovery-token-1",
    });
    expect(mocks.invoke).toHaveBeenCalledWith("notify-new-order", {
      body: { orderId, recoveryToken: "recovery-token-1" },
    });
    expect(order).toMatchObject({
      id: orderId,
      total_amount: 120000,
      status: "pending",
    });
  });

  it("parses customer recovery rows and empty responses without changing shape", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: [orderResponse], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    await expect(
      getCustomerOrder(orderId, "recovery-token-1"),
    ).resolves.toMatchObject({ id: orderId, total_amount: 120000 });
    await expect(
      getCustomerOrder(orderId, "recovery-token-1"),
    ).resolves.toBeNull();
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "get_customer_order", {
      p_order_id: orderId,
      p_recovery_token: "recovery-token-1",
    });
  });

  it("normalizes order status counts returned as numeric strings", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        pending: "2",
        confirmed: "3",
        cancelled: "4",
        expired: "5",
        all: "14",
      },
      error: null,
    });

    await expect(
      getOrderStatusCounts(shopId, {
        createdAfter: "2026-07-01T00:00:00.000Z",
        createdBefore: "2026-08-01T00:00:00.000Z",
      }),
    ).resolves.toEqual({
      pending: 2,
      confirmed: 3,
      cancelled: 4,
      expired: 5,
      all: 14,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("get_order_status_counts", {
      p_shop_id: shopId,
      p_created_after: "2026-07-01T00:00:00.000Z",
      p_created_before: "2026-08-01T00:00:00.000Z",
    });
  });
});

describe("gacha publish contract", () => {
  it("keeps draft persistence and the v5 publish payload stable", async () => {
    const settings = {
      ...defaultGachaSettings(shopId),
      enabled: true,
      title: "  Event Wish  ",
      description: "  Featured shelf  ",
      updated_at: "2026-07-21T00:00:00.000Z",
    };
    const banner = {
      id: "banner-1",
      shop_id: shopId,
      name: "Character Event Wish",
      description: "Featured finds",
      kind: "character" as const,
      theme: "anemo" as const,
      display_limit: 3,
      sort_order: 7,
      active: true,
      starts_at: null,
      ends_at: null,
      updated_at: "2026-07-21T00:00:00.000Z",
    };
    const entry = {
      shop_id: shopId,
      banner_id: banner.id,
      product_id: product.id,
      kind: "character" as const,
      element: "anemo" as const,
      weapon_type: "sword" as const,
      rarity: 5 as const,
      weight: 100,
      featured: true,
      active: true,
      updated_at: "2026-07-21T00:00:00.000Z",
    };
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null });

    await publishGachaConfiguration(shopId, "genshin", {
      settings,
      banners: [banner],
      entries: [entry],
    });

    expect(mocks.from).toHaveBeenCalledWith("gacha_game_configs");
    expect(mocks.upsert).toHaveBeenCalledWith(
      {
        shop_id: shopId,
        game_type: "genshin",
        config: expect.objectContaining({
          settings: expect.objectContaining({
            title: "Event Wish",
            description: "Featured shelf",
          }),
        }),
      },
      { onConflict: "shop_id,game_type" },
    );
    expect(mocks.rpc).toHaveBeenCalledWith("publish_gacha_configuration_v5", {
      p_shop_id: shopId,
      p_game_type: "genshin",
      p_config: {
        settings: {
          ...settings,
          title: "Event Wish",
          description: "Featured shelf",
        },
        banners: [
          {
            id: banner.id,
            name: banner.name,
            description: banner.description,
            kind: banner.kind,
            theme: banner.theme,
            display_limit: banner.display_limit,
            active: true,
            starts_at: null,
            ends_at: null,
          },
        ],
        entries: [
          {
            banner_id: banner.id,
            product_id: product.id,
            kind: entry.kind,
            element: entry.element,
            weapon_type: entry.weapon_type,
            rarity: entry.rarity,
            weight: entry.weight,
            featured: true,
            active: true,
          },
        ],
      },
    });
  });
});

describe("catalog response contracts", () => {
  it("normalizes public product values and filters unsafe image URLs", () => {
    expect(
      normalizeProduct({
        ...product,
        price_vnd: "120000" as unknown as number,
        quantity_available: 0,
        images: ["https://example.test/moon.jpg", "javascript:alert(1)"],
      }),
    ).toMatchObject({
      id: "moon-stand",
      price_vnd: 120000,
      quantity_available: 0,
      stock_status: "sold_out",
      images: ["https://example.test/moon.jpg"],
    });
  });

  it("preserves complete and partial catalog snapshot semantics", () => {
    saveCatalogSnapshot({ products: [product], booth: defaultBooth }, shopId, {
      replaceProducts: true,
      complete: false,
    });
    expect(loadCatalogSnapshot(shopId)).toMatchObject({
      products: [product],
      complete: false,
    });

    saveCatalogSnapshot(
      {
        products: [{ ...product, id: "sun-print", name: "Sun Print" }],
        booth: defaultBooth,
      },
      shopId,
      { complete: true },
    );
    expect(loadCatalogSnapshot(shopId)).toMatchObject({
      products: [
        product,
        expect.objectContaining({ id: "sun-print", name: "Sun Print" }),
      ],
      complete: true,
    });
  });
});

describe("Playwright Supabase request inventory", () => {
  it("records every mocked RPC and table path", () => {
    const fixture = fs.readFileSync(
      path.resolve(process.cwd(), "e2e/fixtures.ts"),
      "utf8",
    );
    const actual = [
      ...fixture.matchAll(/\/(?:rest)\/v1\/[A-Za-z0-9_/-]+/g),
    ].map(([value]) => value);

    expect([...new Set(actual)].sort()).toEqual([
      "/rest/v1/booth_settings",
      "/rest/v1/gacha_game_configs",
      "/rest/v1/gacha_published_configs",
      "/rest/v1/orders",
      "/rest/v1/payment_settings",
      "/rest/v1/products",
      "/rest/v1/promotion_products",
      "/rest/v1/promotions",
      "/rest/v1/rpc/create_order",
      "/rest/v1/rpc/get_admin_booth_settings",
      "/rest/v1/rpc/get_admin_products",
      "/rest/v1/rpc/get_customer_order",
      "/rest/v1/rpc/get_my_shop_memberships",
      "/rest/v1/rpc/get_order_status_counts",
      "/rest/v1/rpc/get_public_product_categories",
      "/rest/v1/rpc/get_shop_members",
      "/rest/v1/rpc/get_shop_workspace_summary",
      "/rest/v1/rpc/publish_gacha_configuration_v5",
      "/rest/v1/shops",
      "/rest/v1/staff_members",
    ]);
  });
});
