import type { Product } from "./catalog";

export type GachaItemKind = "character" | "weapon";
export type GachaRarity = 3 | 4 | 5;
export type GachaElement =
  | "anemo"
  | "geo"
  | "electro"
  | "dendro"
  | "hydro"
  | "pyro"
  | "cryo";
export type GachaWeaponType =
  | "sword"
  | "claymore"
  | "polearm"
  | "bow"
  | "catalyst";

export type GachaSettings = {
  shop_id: string;
  enabled: boolean;
  title: string;
  description: string;
  rare_pity: number;
  legendary_pity: number;
  updated_at?: string;
};

export type GachaPoolEntry = {
  shop_id: string;
  banner_id: string;
  product_id: string;
  kind: GachaItemKind;
  element: GachaElement;
  weapon_type: GachaWeaponType;
  rarity: GachaRarity;
  weight: number;
  featured: boolean;
  active: boolean;
  updated_at?: string;
};

export type GachaBanner = {
  id: string;
  shop_id: string;
  name: string;
  description: string;
  kind: GachaItemKind;
  theme: GachaElement;
  display_limit: number;
  sort_order: number;
  active: boolean;
  updated_at?: string;
};

export type GachaPoolItem = GachaPoolEntry & {
  product: Product;
};

export type GachaCatalog = {
  settings: GachaSettings | null;
  banners: GachaBanner[];
  entries: GachaPoolItem[];
};

export const defaultGachaSettings = (shopId: string): GachaSettings => ({
  shop_id: shopId,
  enabled: false,
  title: "Wish upon the shelf",
  description:
    "Meet a surprise character or discover a featured weapon from this shop.",
  rare_pity: 10,
  legendary_pity: 50,
});

export const defaultGachaBanner = (
  shopId: string,
  id: string = crypto.randomUUID(),
): GachaBanner => ({
  id,
  shop_id: shopId,
  name: "Merch Event Wish",
  description: "Featured finds from this shelf.",
  kind: "character",
  theme: "anemo",
  display_limit: 3,
  sort_order: 0,
  active: true,
});
