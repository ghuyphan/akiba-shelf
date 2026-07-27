import { describe, expect, it } from "vitest";
import { defaultBooth } from "../../constants";
import { storefrontBootstrapSchema } from "../../schemas";
import { normalizeStorefrontBootstrap } from "../storefrontBootstrapNormalization";

describe("storefront bootstrap normalization", () => {
  it("keeps fast and SDK callers on one normalized contract", () => {
    const parsed = storefrontBootstrapSchema.parse({
      shop: {
        id: "11000000-0000-4000-8000-000000000001",
        name: "Fixture Booth",
        slug: "fixture-booth",
        active: true,
        accepting_orders: true,
        catalog_source_shop_id: null,
      },
      catalog_shop_id: "11000000-0000-4000-8000-000000000001",
      products: [
        {
          id: "moon-stand",
          name: "Moon Stand",
          collection: "Night",
          description: "A bright acrylic stand",
          price_vnd: "120000",
          sale_price_vnd: null,
          effective_price_vnd: "120000",
          promotion_eligible: true,
          item_code: "MOON-1",
          quantity_available: 0,
          category: "Acrylic",
          badge: "Limited",
          badge_color: "#5f8d55",
          stock_status: "limited",
          stock_note: "Limited stock",
          images: ["https://example.test/moon.jpg", "javascript:alert(1)"],
          image_variants: [],
          image_paths: [],
          featured: true,
          sort_order: 1,
          active: true,
        },
      ],
      has_more: false,
      booth: null,
      categories: ["Acrylic"],
      promotion: {
        enabled: false,
        buy_quantity: "3",
        free_quantity: "1",
        repeatable: true,
        qualifying_product_ids: [],
        reward_product_ids: [],
      },
      gacha_enabled: false,
    });

    expect(normalizeStorefrontBootstrap(parsed)).toMatchObject({
      booth: {
        ...defaultBooth,
        shop_id: "11000000-0000-4000-8000-000000000001",
      },
      products: [
        {
          id: "moon-stand",
          price_vnd: 120000,
          quantity_available: 0,
          stock_status: "sold_out",
          images: ["https://example.test/moon.jpg"],
        },
      ],
      promotion: {
        buy_quantity: 3,
        free_quantity: 1,
      },
    });
  });
});
