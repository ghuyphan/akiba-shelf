import type { Product } from "./catalog";

export type GachaGameType = "genshin" | "hsr";

export type GachaItemKind = "character" | "weapon" | "lightcone";
export type GachaRarity = 3 | 4 | 5;
export type GachaElement =
  | "anemo"
  | "geo"
  | "electro"
  | "dendro"
  | "hydro"
  | "pyro"
  | "cryo"
  | "physical"
  | "fire"
  | "ice"
  | "lightning"
  | "wind"
  | "quantum"
  | "imaginary";
export type GachaWeaponType =
  | "sword"
  | "claymore"
  | "polearm"
  | "bow"
  | "catalyst"
  | "destruction"
  | "hunt"
  | "erudition"
  | "harmony"
  | "nihility"
  | "preservation"
  | "abundance";

export type GachaSettings = {
  shop_id: string;
  enabled: boolean;
  game_type: GachaGameType;
  title: string;
  description: string;
  rare_base_rate: number;
  legendary_base_rate: number;
  lightcone_legendary_base_rate: number;
  rare_soft_pity: number;
  legendary_soft_pity: number;
  lightcone_legendary_soft_pity: number;
  featured_item_rate: number;
  featured_guaranteed_after_loss: boolean;
  rare_pity: number;
  legendary_pity: number;
  lightcone_legendary_pity: number;
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
  starts_at: string | null;
  ends_at: string | null;
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

export type GachaGameConfiguration = {
  settings: GachaSettings;
  banners: GachaBanner[];
  entries: GachaPoolEntry[];
};

export type GachaGameConfigurations = Partial<
  Record<GachaGameType, GachaGameConfiguration>
>;

/** The currently published minigame state, as seen by the public storefront. */
export type GachaLiveStatus = {
  settings: GachaSettings;
  bannerCount: number;
  entryCount: number;
};

export const defaultGachaSettings = (shopId: string): GachaSettings => ({
  shop_id: shopId,
  enabled: false,
  game_type: "genshin",
  title: "Wish upon the shelf",
  description:
    "Meet a surprise character or discover a featured weapon from this shop.",
  rare_base_rate: 5.1,
  legendary_base_rate: 0.6,
  lightcone_legendary_base_rate: 0.8,
  rare_soft_pity: 9,
  legendary_soft_pity: 49,
  lightcone_legendary_soft_pity: 79,
  featured_item_rate: 50,
  featured_guaranteed_after_loss: true,
  rare_pity: 10,
  legendary_pity: 50,
  lightcone_legendary_pity: 80,
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
  starts_at: null,
  ends_at: null,
});
