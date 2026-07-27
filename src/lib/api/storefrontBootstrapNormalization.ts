import type { z } from "zod";
import { defaultBooth } from "../constants";
import { storefrontBootstrapSchema } from "../schemas";
import type { StorefrontBootstrap } from "../../types/catalog";
import { normalizeProduct } from "./productNormalization";
import {
  normalizeBooth,
  normalizePromotion,
} from "./settingsNormalization";

type StorefrontBootstrapPayload = z.infer<typeof storefrontBootstrapSchema>;

export function normalizeStorefrontBootstrap(
  parsed: StorefrontBootstrapPayload,
): StorefrontBootstrap {
  return {
    shop: parsed.shop,
    catalogShopId: parsed.catalog_shop_id,
    products: parsed.products.map(normalizeProduct),
    hasMore: parsed.has_more,
    booth: normalizeBooth(
      parsed.booth ?? { ...defaultBooth, shop_id: parsed.catalog_shop_id },
    ),
    categories: parsed.categories,
    promotion: normalizePromotion(parsed.promotion),
    gachaEnabled: parsed.gacha_enabled,
  };
}
