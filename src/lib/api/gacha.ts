import {
  capGachaFeaturedEntries,
  normalizeGachaBanners,
  normalizeGachaDisplayLimit,
} from "../gacha/gachaLimits";
import { defaultGachaBanner, defaultGachaSettings } from "../../types/gacha";
import type {
  GachaBanner,
  GachaCatalog,
  GachaCatalogsByGame,
  GachaElement,
  GachaGameConfiguration,
  GachaGameConfigurations,
  GachaGameType,
  GachaItemKind,
  GachaLiveStatusesByGame,
  GachaPoolEntry,
  GachaPoolItem,
  GachaRarity,
  GachaSettings,
  GachaWeaponType,
} from "../../types/gacha";
import { getPublicProductsByIds } from "./products";
import { booleanValue, numberValue, requireSupabase, text } from "./shared";

const elements = [
  "anemo",
  "geo",
  "electro",
  "dendro",
  "hydro",
  "pyro",
  "cryo",
  "physical",
  "fire",
  "ice",
  "lightning",
  "wind",
  "quantum",
  "imaginary",
] as const;

const weaponTypes = [
  "sword",
  "claymore",
  "polearm",
  "bow",
  "catalyst",
  "destruction",
  "hunt",
  "erudition",
  "harmony",
  "nihility",
  "preservation",
  "abundance",
] as const;

function normalizeGachaSettings(
  value: Record<string, unknown>,
  shopId: string,
): GachaSettings {
  const defaults = defaultGachaSettings(shopId);
  const rarePity = Math.min(
    30,
    Math.max(2, numberValue(value.rare_pity, defaults.rare_pity)),
  );
  const legendaryPity = Math.min(
    100,
    Math.max(10, numberValue(value.legendary_pity, defaults.legendary_pity)),
  );
  const lightconePity = Math.min(
    100,
    Math.max(
      10,
      numberValue(
        value.lightcone_legendary_pity,
        defaults.lightcone_legendary_pity,
      ),
    ),
  );
  return {
    shop_id: text(value.shop_id, shopId),
    enabled: booleanValue(value.enabled),
    game_type: value.game_type === "hsr" ? "hsr" : "genshin",
    title: text(value.title, defaults.title),
    description: text(value.description, defaults.description),
    rare_base_rate: Math.min(
      99.99,
      Math.max(
        0.01,
        numberValue(value.rare_base_rate, defaults.rare_base_rate),
      ),
    ),
    legendary_base_rate: Math.min(
      99.99,
      Math.max(
        0.01,
        numberValue(value.legendary_base_rate, defaults.legendary_base_rate),
      ),
    ),
    lightcone_legendary_base_rate: Math.min(
      99.99,
      Math.max(
        0.01,
        numberValue(
          value.lightcone_legendary_base_rate,
          defaults.lightcone_legendary_base_rate,
        ),
      ),
    ),
    rare_soft_pity: Math.min(
      rarePity - 1,
      Math.max(1, numberValue(value.rare_soft_pity, rarePity - 1)),
    ),
    legendary_soft_pity: Math.min(
      legendaryPity - 1,
      Math.max(1, numberValue(value.legendary_soft_pity, legendaryPity - 1)),
    ),
    lightcone_legendary_soft_pity: Math.min(
      lightconePity - 1,
      Math.max(
        1,
        numberValue(value.lightcone_legendary_soft_pity, lightconePity - 1),
      ),
    ),
    featured_item_rate: Math.min(
      100,
      Math.max(
        0,
        numberValue(value.featured_item_rate, defaults.featured_item_rate),
      ),
    ),
    featured_guaranteed_after_loss: booleanValue(
      value.featured_guaranteed_after_loss,
      defaults.featured_guaranteed_after_loss,
    ),
    rare_pity: rarePity,
    legendary_pity: legendaryPity,
    lightcone_legendary_pity: lightconePity,
    updated_at: text(value.updated_at) || undefined,
  };
}

function normalizeGachaBanner(
  value: Record<string, unknown>,
  shopId: string,
  gameType: GachaGameType = "genshin",
): GachaBanner {
  const defaults = defaultGachaBanner(shopId, text(value.id));
  const theme = text(value.theme);
  return {
    id: text(value.id, defaults.id),
    shop_id: text(value.shop_id, shopId),
    name: text(value.name, defaults.name),
    description: text(value.description, defaults.description),
    kind: (value.kind === "weapon" || value.kind === "lightcone"
      ? value.kind
      : "character") as GachaItemKind,
    theme: (elements.includes(theme as GachaElement)
      ? theme
      : defaults.theme) as GachaElement,
    display_limit: normalizeGachaDisplayLimit(
      numberValue(value.display_limit, defaults.display_limit),
      gameType,
    ),
    sort_order: Math.min(
      1000,
      Math.max(0, numberValue(value.sort_order, defaults.sort_order)),
    ),
    active: booleanValue(value.active, true),
    starts_at: text(value.starts_at) || null,
    ends_at: text(value.ends_at) || null,
    updated_at: text(value.updated_at) || undefined,
  };
}

function normalizeGachaPoolEntry(
  value: Record<string, unknown>,
  shopId: string,
): GachaPoolEntry {
  const rarity = numberValue(value.rarity, 3);
  const element = text(value.element);
  const weaponType = text(value.weapon_type);
  return {
    shop_id: text(value.shop_id, shopId),
    banner_id: text(value.banner_id),
    product_id: text(value.product_id),
    kind: (value.kind === "weapon" || value.kind === "lightcone"
      ? value.kind
      : "character") as GachaItemKind,
    element: (elements.includes(element as GachaElement)
      ? element
      : "anemo") as GachaElement,
    weapon_type: (weaponTypes.includes(weaponType as GachaWeaponType)
      ? weaponType
      : "sword") as GachaWeaponType,
    rarity: (rarity === 4 || rarity === 5 ? rarity : 3) as GachaRarity,
    weight: Math.min(1000, Math.max(1, numberValue(value.weight, 100))),
    featured: booleanValue(value.featured),
    active: booleanValue(value.active, true),
    updated_at: text(value.updated_at) || undefined,
  };
}

function normalizeStoredGameConfiguration(
  value: unknown,
  shopId: string,
  gameType: GachaGameType,
): GachaGameConfiguration | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const rawSettings =
    record.settings && typeof record.settings === "object"
      ? (record.settings as Record<string, unknown>)
      : {};
  const settings = normalizeGachaSettings(
    { ...rawSettings, game_type: gameType },
    shopId,
  );
  const banners = Array.isArray(record.banners)
    ? record.banners.map((banner) =>
        normalizeGachaBanner(
          banner as Record<string, unknown>,
          shopId,
          gameType,
        ),
      )
    : [];
  const entries = Array.isArray(record.entries)
    ? record.entries.map((entry) =>
        normalizeGachaPoolEntry(entry as Record<string, unknown>, shopId),
      )
    : [];
  return {
    settings,
    banners,
    entries: capGachaFeaturedEntries(entries, banners, gameType),
  };
}

export async function getGachaCatalogs(
  shopId: string,
): Promise<GachaCatalogsByGame> {
  const { data, error } = await requireSupabase()
    .from("gacha_published_configs")
    .select("game_type,config")
    .eq("shop_id", shopId);
  if (error) throw error;
  const configurations = (
    (data ?? []) as {
      game_type: string;
      config: unknown;
    }[]
  ).flatMap((row) => {
    if (row.game_type !== "genshin" && row.game_type !== "hsr") return [];
    const config = normalizeStoredGameConfiguration(
      row.config,
      shopId,
      row.game_type,
    );
    return config ? [[row.game_type, config] as const] : [];
  });
  const allEntries = configurations.flatMap(([, config]) => config.entries);
  const products = await getPublicProductsByIds(
    shopId,
    allEntries.map((entry) => entry.product_id),
  );
  const productsById = new Map(
    products.map((product) => [product.id, product]),
  );
  return Object.fromEntries(
    configurations.map(([gameType, config]) => [
      gameType,
      {
        settings: config.settings,
        banners: config.banners.filter((banner) => banner.active),
        entries: config.entries.flatMap((entry): GachaPoolItem[] => {
          if (!entry.active) return [];
          const product = productsById.get(entry.product_id);
          return product ? [{ ...entry, product }] : [];
        }),
      },
    ]),
  ) as GachaCatalogsByGame;
}

export async function getGachaCatalog(shopId: string): Promise<GachaCatalog> {
  const catalogs = await getGachaCatalogs(shopId);
  return (
    catalogs.genshin ??
    catalogs.hsr ?? { settings: null, banners: [], entries: [] }
  );
}

export async function getPublicGachaEnabled(shopId: string): Promise<boolean> {
  const { data, error } = await requireSupabase()
    .from("gacha_published_configs")
    .select("game_type")
    .eq("shop_id", shopId)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function getAdminGachaConfiguration(shopId: string): Promise<{
  configurations: GachaGameConfigurations;
  liveByGame: GachaLiveStatusesByGame;
}> {
  const client = requireSupabase();
  const [configsResult, publishedResult] = await Promise.all([
    client
      .from("gacha_game_configs")
      .select("game_type,config")
      .eq("shop_id", shopId),
    client
      .from("gacha_published_configs")
      .select("game_type,config")
      .eq("shop_id", shopId),
  ]);
  if (configsResult.error) throw configsResult.error;
  if (publishedResult.error) throw publishedResult.error;
  const storedConfigs = Object.fromEntries(
    ((configsResult.data ?? []) as { game_type: string; config: unknown }[])
      .filter((row) => row.game_type === "genshin" || row.game_type === "hsr")
      .map((row) => [row.game_type, row.config]),
  );
  const configurations = (
    ["genshin", "hsr"] as GachaGameType[]
  ).reduce<GachaGameConfigurations>((configs, gameType) => {
    configs[gameType] = normalizeStoredGameConfiguration(
      storedConfigs[gameType],
      shopId,
      gameType,
    ) ?? {
      settings: { ...defaultGachaSettings(shopId), game_type: gameType },
      banners: [],
      entries: [],
    };
    return configs;
  }, {});
  const liveByGame = Object.fromEntries(
    (
      (publishedResult.data ?? []) as { game_type: string; config: unknown }[]
    ).flatMap((row) => {
      if (row.game_type !== "genshin" && row.game_type !== "hsr") return [];
      const config = normalizeStoredGameConfiguration(
        row.config,
        shopId,
        row.game_type,
      );
      return config
        ? [
            [
              row.game_type,
              {
                settings: config.settings,
                bannerCount: config.banners.filter((banner) => banner.active)
                  .length,
                entryCount: config.entries.filter((entry) => entry.active)
                  .length,
              },
            ] as const,
          ]
        : [];
    }),
  ) as GachaLiveStatusesByGame;
  return { configurations, liveByGame };
}

function normalizedDraftConfig(
  shopId: string,
  gameType: GachaGameType,
  config: GachaGameConfiguration,
): GachaGameConfiguration {
  const banners = normalizeGachaBanners(config.banners, gameType);
  return {
    settings: {
      ...config.settings,
      shop_id: shopId,
      game_type: gameType,
      title: config.settings.title.trim(),
      description: config.settings.description.trim(),
    },
    banners,
    entries: capGachaFeaturedEntries(config.entries, banners, gameType),
  };
}

export async function saveGachaDraft(
  shopId: string,
  gameType: GachaGameType,
  config: GachaGameConfiguration,
): Promise<GachaGameConfiguration> {
  const draft = normalizedDraftConfig(shopId, gameType, config);
  const { error } = await requireSupabase()
    .from("gacha_game_configs")
    .upsert(
      { shop_id: shopId, game_type: gameType, config: draft },
      { onConflict: "shop_id,game_type" },
    );
  if (error) throw error;
  return draft;
}

export async function publishGachaConfiguration(
  shopId: string,
  gameType: GachaGameType,
  config: GachaGameConfiguration,
): Promise<GachaGameConfiguration> {
  const draft = await saveGachaDraft(shopId, gameType, config);
  const { error } = await requireSupabase().rpc(
    "publish_gacha_configuration_v5",
    {
      p_shop_id: shopId,
      p_game_type: gameType,
      p_config: {
        settings: draft.settings,
        banners: draft.banners.map((banner) => ({
          id: banner.id,
          name: banner.name,
          description: banner.description,
          kind: banner.kind,
          theme: banner.theme,
          display_limit: banner.display_limit,
          active: banner.active,
          starts_at: banner.starts_at,
          ends_at: banner.ends_at,
        })),
        entries: draft.entries.map((entry) => ({
          banner_id: entry.banner_id,
          product_id: entry.product_id,
          kind: entry.kind,
          element: entry.element,
          weapon_type: entry.weapon_type,
          rarity: entry.rarity,
          weight: entry.weight,
          featured: entry.featured,
          active: entry.active,
        })),
      },
    },
  );
  if (error) throw error;
  return draft;
}
