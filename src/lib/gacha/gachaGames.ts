import type {
  GachaElement,
  GachaGameType,
  GachaItemKind,
  GachaPoolItem,
  GachaSettings,
  GachaWeaponType,
} from "../../types/gacha";
import hsrPhysicalIcon from "../../../vendor/hsr-simulator/src/images/utils/combat-physical.webp";
import hsrFireIcon from "../../../vendor/hsr-simulator/src/images/utils/combat-fire.webp";
import hsrIceIcon from "../../../vendor/hsr-simulator/src/images/utils/combat-ice.webp";
import hsrLightningIcon from "../../../vendor/hsr-simulator/src/images/utils/combat-lightning.webp";
import hsrWindIcon from "../../../vendor/hsr-simulator/src/images/utils/combat-wind.webp";
import hsrQuantumIcon from "../../../vendor/hsr-simulator/src/images/utils/combat-quantum.webp";
import hsrImaginaryIcon from "../../../vendor/hsr-simulator/src/images/utils/combat-imaginary.webp";

/**
 * Per-game descriptor registry for the gacha minigame. Everything that used
 * to be a `gameType === "hsr" ? … : …` fork lives here: option domains,
 * featured-slot rules, icon assets, and new-item defaults. Adding a third
 * game means adding one entry to GACHA_GAMES (plus the DB game_type check).
 */

export type GachaElementVisual =
  /** Genshin element glyphs: path data in a 512 viewBox, drawn upside down. */
  | { type: "path"; d: string }
  /** HSR combat-type icons: raster assets from the vendored simulator. */
  | { type: "image"; src: string };

export type GachaElementMeta = {
  id: GachaElement;
  color: string;
  visual: GachaElementVisual;
};

export type GachaBannerFeaturedRule = {
  displayLimit: number;
  fiveStarLimit: number;
  fourStarLimit: number;
  /** Event banners must fill every official rate-up slot before going live. */
  requireCompleteComposition: boolean;
  /** HSR standard warps may intentionally publish with no featured entries. */
  allowEmptyComposition: boolean;
};

export type GachaBannerFeaturedRules = {
  character: GachaBannerFeaturedRule;
  gear: GachaBannerFeaturedRule;
};

export type GachaGameDefaults = {
  title: string;
  description: string;
  legendaryPity: number;
  bannerName: string;
  bannerTheme: GachaElement;
  entryElement: GachaElement;
  entryWeaponType: GachaWeaponType;
  displayLimit: number;
};

export type GachaGameDescriptor = {
  gameType: GachaGameType;
  /** Brand label; proper noun, intentionally not translated. */
  label: string;
  /** The non-character kind banners and pool entries can take. */
  gearKind: GachaItemKind;
  /** Element/combat-type ids valid for this game, in UI order. */
  elements: GachaElementMeta[];
  /** Weapon-class / path ids valid for this game, in UI order. */
  weaponTypes: GachaWeaponType[];
  /** Whether the game has a separate gear-banner 5★ pity. */
  hasLightconePity: boolean;
  /** Legacy generic limit used only when a banner kind is unavailable. */
  displayLimitMax: number;
  featuredRules: GachaBannerFeaturedRules;
  defaults: GachaGameDefaults;
};

export const GACHA_GAME_TYPES = [
  "genshin",
  "hsr",
] as const satisfies readonly GachaGameType[];

const genshinElements: GachaElementMeta[] = [
  {
    id: "anemo",
    color: "#33af8f",
    visual: {
      type: "path",
      d: "M238 88c13 4 7 2 18 9 11-7 5-5 19-9-5-18-9-12-14-33z m-10 18c16 14 19 11 24 28l9 0c4-15-3-2 8-15l15-13c-18 2-17 7-28 7-11 0-9-5-28-7z m-191 248c0-109 117-88 168-117 50-28 57-82 16-105-29-16-19 2-53 2 2-27 23-26 47-60 10-14 32-51 37-70l9 0c17 72 81 100 84 130-33 0-23-16-50-3-47 22-52 103 74 124 153 26 99 126 88 173l-10 0c0-148-169-152-186-214l-9 0c-6 23-30 37-50 48-26 14-42 21-66 37-37 24-71 74-71 134-17-13-28-49-28-79z m275-215c19 0 26-1 28 23-65 6-43 56-14 56 27 0 73-42 121-27 87 28 61 120 61 139-32-21-41-87-135-88-63-1-100-31-90-71 3-15 15-32 29-32z m-312 149c0-62 50-120 125-92 12 4 89 49 89-6 0-18-23-26-42-28 5-55 87-6 51 46-42 59-99 10-163 61-30 24-36 49-55 61-1-21-5-18-5-42z m359 154c0-78-22-122-79-172 50 4 139 53 139 107 0 73-7 93-79 131 6-23 19-37 19-66z m-266-32c0-45 5-73 47-103 18-13 65-35 93-37-7 9-18 15-29 26-37 38-50 91-50 146 0 29 13 43 18 66-27-15-30-13-52-36-15-15-27-35-27-62z",
    },
  },
  {
    id: "geo",
    color: "#de9d3c",
    visual: {
      type: "path",
      d: "M361 185z m0 0c-4-42-78-140-106-159-15 23-36 44-53 66-35 46-124 176-128 230-17-5-47-44-53-62-5-12-2-10 7-24 36-58 36-50 66-88 29-37 119-120 161-148 12 3 55 39 65 49 21 21 40 33 60 56l37 46c18 29-20 68-30 109-20-5-104-100-128-97-17 9-18 11-30 27l-23 39c17 26 41 33 58 58-7 9-9 15-18 22-14-4-37-22-47-32-16-15-30-23-41-39 5-24 28-54 42-73l55-64c38 26 68 59 106 84z m-269 164c0-27 28-80 39-102 22 15 36 37 57 54 22 17 42 34 67 48 26-18 38-39 53-67l-59-61 23-24 45 37c14 11 29 24 39 39-7 34-75 116-101 133-19-12-89-79-106-84 23 49 12 35 46 87 10 15 48 64 60 72 14-9 18-15 28-29l78-103c20-30 76-124 79-164l9 0c10 36 63 45 37 90-61 106-222 231-227 237l-89-74c-12-13-78-77-78-89z",
    },
  },
  {
    id: "electro",
    color: "#af89ef",
    visual: {
      type: "path",
      d: "M469 121c-10-3-166-115-224 17-21 48 6 96 40 112 52 25 101-11 73-68 59 13 92 73 93 130 1 25-9 40-9 65 45-30 45-65 65-79 0 87-83 159-152 192-43 20-76 13-94 21 8-24 39-9 96-75 29-34 36-89 8-131-23-34-83-52-122-20-15 12-29 30-27 53 3 28 19 39 49 39l0 9c-17 5-82 60-167 0-14-10-28-24-42-33 3 37 28 71 42 98-40-11-80-93-90-133-14-53-11-126 17-177 6-9 4-5 8-11 0 65 0 100 25 143 20 33 58 60 117 46 101-22 61-184-14-140l-21 21c-1-34-8-71 31-113 18-19 44-33 69-42l20-8c1 0 3-1 4-1 0-1 2-1 3-2 0 0 2 0 3-1-17-4-28-9-48-12-19-3-39-2-59-2 12-10 22-11 41-15 15-4 30-4 52-4 97 0 199 68 213 121z m0 0l5 0-4 6z m38 177l0-5 5 4z",
    },
  },
  {
    id: "dendro",
    color: "#8bc33a",
    visual: {
      type: "path",
      d: "M53 242z m0 0c-36 17-24-2-53-10l0-10c37-9 16-27 57 0 22-46 10-59 92-109 37-22 89-34 104-101 22 16 8 26 42 59 35 34 152 60 159 151 15-3 32-32 57 5-15 23-29 25-52 10 0 99-14 68-24 110l38 0c11 16 22 32 24 57-48 0-70 2-72-48-29 16-38 34-86 34-40 0-62-17-76-43l14-19c20 13 17 24 48 28 121 15 148-144 21-207-107-52-57-39-93-65-15 66-133 46-161 149-19 67 15 130 94 124 43-4 27-22 58-24 6 25 10 25-12 40-14 9-26 15-46 17-47 4-69-16-95-34-12 50-18 48-77 48 24-49 4-57 67-57-9-17-16-23-21-46-5-21-7-35-7-59z m243 57c26 0 31 2 41-17 26-54-42-81-50-112 17 4 10 5 24 14 43 26 44 24 91 24-5 17-5 18-24 19 5 21 19 28 19 43 0 65-97 78-101 29z m-176-14c0-31-2-22 19-53-18-9-18-8-29-24 37 0 42 4 67-9l52-29c-23 43-57 45-57 91 0 31 15 38 48 38-4 44-65 30-82 15-6-4-18-21-18-29z m95 138c0-24 28-47 43-57 17 11 47 37 41 64-5 22-31 60-46 70-15-29-38-55-38-77z",
    },
  },
  {
    id: "hydro",
    color: "#3da9fc",
    visual: {
      type: "path",
      d: "M381 62z m5 5l-5-5z m5 5l-5-5z m5 5l-5-5z m0 0c4 16 97 128-14 239-14 14-25 26-45 35-47 22-92 25-138 10-30-10-30-20-30-57 41-27 31-12 78-7 27 4 62-9 81-21 123-78 64-294-141-242-30 8-52 22-78 28 70-104 315-79 385 99 22 54 25 117 5 176-58 167-254 222-387 131-130-89-78-150-38-139 25 8 84 128 233 93 33-8 53-21 77-39 39-29 73-84 78-145 5-67-28-136-66-161z m-232 71c0-34-1-53 24-77 56-56 133-20 143 16-23-14-75-55-118-11-55 55 33 124 59 74 9-18 6-38 34-40 41-2 45 59 15 89-55 55-157 12-157-51z m-90 101c0 73-105 29-65-19 25-31 65-3 65 19z m-15-96l0-25c10-8 14-12 30-15l8 7c30 31 0 39-18 48-8-6 3 2-8-7-6-4-8-5-12-8z",
    },
  },
  {
    id: "pyro",
    color: "#e35b5b",
    visual: {
      type: "path",
      d: "M406 249z m-291 9l-5-4z m0 0z m138 53z m153-62c30-8 80-76-8-126-74-43-62-32-140-85-68 60-179 76-186 144-4 33 15 65 38 72-5-18-13-18-15-44-4-51 32-79 72-100-6 21-45 53-10 110 18 29 55 52 101 53-1 0-3 2-3 1-13 7-39 19-83 35-84 92l-35-52c-30-40-106-116-71-178 14-24 125-80 182-124 12-9 13-15 29-19 34 23 34 37 100 72 34 17 78 45 98 79 39 71-73 148-84 164-7 9-10 17-16 28-6 14-7 23-12 35-13-9-29-35-28-57 1-28 21-39 28-63-16 11-36 39-43 58-10 29-2 60 5 86-42-11-58-48-58-91-36 42 29 84 39 100 21 30-26 96-44 101-1-77-82-101-65-165 16-58 95-65 140-95 51-35 62-114-1-143-26-13-70-22-97-3-12 9-18 19-15 42 3 22 14 23 24 39-29 0-43 2-56-16-14-18-12-36 2-53 66-79 225-18 235 64 5 36-7 41-9 67z m-215-48c13 3 24 10 38 10 42 0 76-40 48-82 35 3 85 44 37 95-14 16-18 18-44 23-42 7-63-16-79-46z",
    },
  },
  {
    id: "cryo",
    color: "#62c4c7",
    visual: {
      type: "path",
      d: "M258 167c1-34 16-45 19-74-23-6-5-8-28-14-4 14 0 10-14 14l23 74z m0 47c-1 9 6 17 3 3 0 0 0-19-3-3z m-9 0c-2 9 6 17 3 3 0 0 0-19-3-3z m5 19c-2 8 6 16 3 3 0-1 0-20-3-3z m28 4l-11 9c13-3 6 2 11-9z m-52 0c3 12-2 7 10 10z m42 28z m-32 0z m42 10c0-1 8-9 9-10l-19 0 10 10z m-28 9l4 0z m-24-9l10-10-19 0c0 0 9 9 9 10z m66 0c4 4 17-8 5-3 0 0-13-5-5 3z m-89 0c5 4 18-8 5-3 0 0-13-5-5 3z m79 4l-4-4z m-56-4l-4 4z m33 27c0-2 0-7 0-9-3-8-2-4-5-9 0 2 0 7 1 9 2 8 1 5 4 9z m-9-18c-5 6-5-10-5 14 4-6 3 5 5-14z m83 18z m-162 0z m162 0c11 17 19 17 42 52 10-5 19-8 33-10-5-10-8-18-9-32-30 0-41-7-66-10z m-162 0c-25 3-36 10-66 10-1 14-4 22-9 32 14 2 23 5 33 10 23-35 31-35 42-52z m60 108l20 22 23-21-24-67c-1 19-12 49-19 66z m-9-131c-20 5-28 21-39 36l-31 48 15 18c-45 1-99-3-136 5l70-121c10 43 46 15 97 14-11-17-12-9-23-23 9-13 12-17 33-19 1 1 2 3 3 2 0-1 2 1 2 1 10 0 3 1 9-3l4 0-4-4-10-10-4-4c0-19 1-19 4-33 18 4 23 8 33 19-1-17-9-36-15-50-7-15-19-30-22-43-8 4-15 5-23 9l65-121c16 12 23 39 34 58 11 18 31 46 35 63-8-4-15-5-23-9-5 18-34 53-37 93 10-11 15-15 33-19 3 14 4 14 4 33l-4 4-5 5-5 5-4 4 4 0c1 1 3 3 3 2 0-1 2 1 3 1 9 0 3 1 8-3 21 2 24 6 33 19-11 14-12 6-24 23 17 1 44 7 58 9 43 5 27-10 45-23 7 30 60 98 65 121-37-8-91-4-135-4l15-18-15-24c-11-19-35-55-56-61 22 32 13 6 10 47-17-9-21-10-33-24 0 22 11 46 18 61 22 44 25 32 42 28l-51 89c-6 11-8 20-14 32l-69-121c17 4 13 10 26-2 10-9 33-62 34-87-12 14-16 15-33 24-8-36-6-23 10-47z m111-70c12-2 20-6 30-8 16-3 22-2 35-6 3-11 5-23 10-32-22 0-19-3-37-5-6 20-27 36-38 51z m-37 28l-14 0 0-4 5-5 5-5 4-4c24-16 33-36 48-59 6-9 2-4 8-11-8-21 1 2-7-11-5-8-4-2-7-12 29 0 37 5 65 5 25-1 39-5 70-5-6 21-56 80-65 121-9-10-8-7-10-24-16 0-39-1-55 1l-47 13z m-163-79c-18 2-15 5-37 5 5 9 7 21 9 32l66 14c-11-15-32-31-38-51z m75 61l4 4 10 10 0 4-14 0-44-12c-18-3-39-2-59-2-1 17 0 14-9 24-8-37-60-101-65-121 30 0 42 3 65 4 30 2 40-4 70-4-4 15-8 6-14 23 4 5 1 0 6 8 16 23 25 45 50 62z",
    },
  },
];

const hsrElements: GachaElementMeta[] = [
  {
    id: "physical",
    color: "#9aa2af",
    visual: { type: "image", src: hsrPhysicalIcon },
  },
  { id: "fire", color: "#f2615a", visual: { type: "image", src: hsrFireIcon } },
  { id: "ice", color: "#4bc2f1", visual: { type: "image", src: hsrIceIcon } },
  {
    id: "lightning",
    color: "#d772f1",
    visual: { type: "image", src: hsrLightningIcon },
  },
  { id: "wind", color: "#51eb99", visual: { type: "image", src: hsrWindIcon } },
  {
    id: "quantum",
    color: "#7c55f1",
    visual: { type: "image", src: hsrQuantumIcon },
  },
  {
    id: "imaginary",
    color: "#f1ca4b",
    visual: { type: "image", src: hsrImaginaryIcon },
  },
];

export const GACHA_GAMES: Record<GachaGameType, GachaGameDescriptor> = {
  genshin: {
    gameType: "genshin",
    label: "Genshin Impact",
    gearKind: "weapon",
    elements: genshinElements,
    weaponTypes: ["sword", "claymore", "polearm", "bow", "catalyst"],
    hasLightconePity: false,
    displayLimitMax: 5,
    featuredRules: {
      character: {
        displayLimit: 4,
        fiveStarLimit: 1,
        fourStarLimit: 3,
        requireCompleteComposition: true,
        allowEmptyComposition: false,
      },
      gear: {
        displayLimit: 7,
        fiveStarLimit: 2,
        fourStarLimit: 5,
        requireCompleteComposition: true,
        allowEmptyComposition: false,
      },
    },
    defaults: {
      title: "Wish upon the shelf",
      description:
        "Meet a surprise character or discover a featured weapon from this shop.",
      legendaryPity: 50,
      bannerName: "Merch Event Wish",
      bannerTheme: "anemo",
      entryElement: "anemo",
      entryWeaponType: "sword",
      displayLimit: 4,
    },
  },
  hsr: {
    gameType: "hsr",
    label: "Honkai: Star Rail",
    gearKind: "lightcone",
    elements: hsrElements,
    weaponTypes: [
      "destruction",
      "hunt",
      "erudition",
      "harmony",
      "nihility",
      "preservation",
      "abundance",
    ],
    hasLightconePity: true,
    displayLimitMax: 4,
    featuredRules: {
      character: {
        displayLimit: 4,
        fiveStarLimit: 1,
        fourStarLimit: 3,
        requireCompleteComposition: true,
        allowEmptyComposition: true,
      },
      gear: {
        displayLimit: 4,
        fiveStarLimit: 1,
        fourStarLimit: 3,
        requireCompleteComposition: true,
        allowEmptyComposition: true,
      },
    },
    defaults: {
      title: "Warp upon the shelf",
      description:
        "Discover a featured character or Light Cone from this shop.",
      legendaryPity: 90,
      bannerName: "Merch Event Warp",
      bannerTheme: "physical",
      entryElement: "physical",
      entryWeaponType: "destruction",
      displayLimit: 4,
    },
  },
};

export function getGachaGameDescriptor(
  gameType: GachaGameType,
): GachaGameDescriptor {
  return GACHA_GAMES[gameType];
}

export function getGachaBannerFeaturedRule(
  gameType: GachaGameType,
  bannerKind: GachaItemKind,
): GachaBannerFeaturedRule {
  const rules = getGachaGameDescriptor(gameType).featuredRules;
  return bannerKind === "character" ? rules.character : rules.gear;
}

export function getGachaElementMeta(
  gameType: GachaGameType,
  id: string,
): GachaElementMeta | undefined {
  return GACHA_GAMES[gameType].elements.find((element) => element.id === id);
}

export type GachaPresetId = "booth_fast" | "official";

export type GachaPreset = {
  id: GachaPresetId;
  name: string;
  description: string;
  settings: Partial<GachaSettings>;
};

export const GACHA_PRESETS: Record<
  GachaGameType,
  Record<GachaPresetId, GachaPreset>
> = {
  genshin: {
    booth_fast: {
      id: "booth_fast",
      name: "Convention Booth Mode",
      description:
        "Fast 50 pity with generous odds for physical event visitors.",
      settings: {
        rare_base_rate: 6.0,
        legendary_base_rate: 1.5,
        rare_pity: 10,
        rare_soft_pity: 8,
        legendary_pity: 50,
        legendary_soft_pity: 40,
        featured_item_rate: 50,
        featured_guaranteed_after_loss: true,
      },
    },
    official: {
      id: "official",
      name: "Official Genshin Replica",
      description: "Exact official game rates (90 hard pity, 74 soft pity).",
      settings: {
        rare_base_rate: 5.1,
        legendary_base_rate: 0.6,
        rare_pity: 10,
        rare_soft_pity: 9,
        legendary_pity: 90,
        legendary_soft_pity: 74,
        featured_item_rate: 50,
        featured_guaranteed_after_loss: true,
      },
    },
  },
  hsr: {
    booth_fast: {
      id: "booth_fast",
      name: "Convention Booth Mode",
      description:
        "Fast 50 pity with generous odds for physical event visitors.",
      settings: {
        rare_base_rate: 6.0,
        legendary_base_rate: 1.5,
        lightcone_legendary_base_rate: 2.0,
        rare_pity: 10,
        rare_soft_pity: 8,
        legendary_pity: 50,
        legendary_soft_pity: 40,
        lightcone_legendary_pity: 50,
        lightcone_legendary_soft_pity: 40,
        featured_item_rate: 50,
        featured_guaranteed_after_loss: true,
      },
    },
    official: {
      id: "official",
      name: "Official Star Rail Replica",
      description:
        "Exact official game rates (90 character pity, 80 Light Cone pity).",
      settings: {
        rare_base_rate: 5.1,
        legendary_base_rate: 0.6,
        lightcone_legendary_base_rate: 0.8,
        rare_pity: 10,
        rare_soft_pity: 9,
        legendary_pity: 90,
        legendary_soft_pity: 74,
        lightcone_legendary_pity: 80,
        lightcone_legendary_soft_pity: 65,
        featured_item_rate: 50,
        featured_guaranteed_after_loss: true,
      },
    },
  },
};

export type FallbackSouvenir = {
  id: string;
  name: string;
  kind: GachaItemKind;
  element: GachaElement;
  weapon_type: GachaWeaponType;
};

export const DEFAULT_3STAR_SOUVENIRS: Record<
  GachaGameType,
  FallbackSouvenir[]
> = {
  genshin: [
    {
      id: "fallback-genshin-1",
      name: "Akiba Booth Postcard",
      kind: "weapon",
      element: "anemo",
      weapon_type: "sword",
    },
    {
      id: "fallback-genshin-2",
      name: "Convention Event Badge",
      kind: "weapon",
      element: "geo",
      weapon_type: "claymore",
    },
    {
      id: "fallback-genshin-3",
      name: "Akiba Collector Sticker",
      kind: "weapon",
      element: "pyro",
      weapon_type: "bow",
    },
    {
      id: "fallback-genshin-4",
      name: "Shelf Souvenir Magnet",
      kind: "weapon",
      element: "hydro",
      weapon_type: "catalyst",
    },
    {
      id: "fallback-genshin-5",
      name: "Exclusive Art Bookmark",
      kind: "weapon",
      element: "electro",
      weapon_type: "polearm",
    },
  ],
  hsr: [
    {
      id: "fallback-hsr-1",
      name: "Astral Express Ticket",
      kind: "lightcone",
      element: "physical",
      weapon_type: "destruction",
    },
    {
      id: "fallback-hsr-2",
      name: "Space Station Access Pass",
      kind: "lightcone",
      element: "ice",
      weapon_type: "preservation",
    },
    {
      id: "fallback-hsr-3",
      name: "Cosmic Booth Sticker",
      kind: "lightcone",
      element: "lightning",
      weapon_type: "erudition",
    },
    {
      id: "fallback-hsr-4",
      name: "Interastral Event Pin",
      kind: "lightcone",
      element: "wind",
      weapon_type: "hunt",
    },
    {
      id: "fallback-hsr-5",
      name: "Trash Can Souvenir Badge",
      kind: "lightcone",
      element: "fire",
      weapon_type: "nihility",
    },
  ],
};

export function getGachaFallback3StarEntries(
  shopId: string,
  bannerId: string,
  gameType: GachaGameType,
): GachaPoolItem[] {
  const souvenirs =
    DEFAULT_3STAR_SOUVENIRS[gameType] ?? DEFAULT_3STAR_SOUVENIRS.genshin;
  const fallbackImage = `${import.meta.env.BASE_URL}brand/matsuri-icon-512.png`;
  return souvenirs.map((item) => ({
    shop_id: shopId,
    banner_id: bannerId,
    product_id: item.id,
    kind: item.kind,
    element: item.element,
    weapon_type: item.weapon_type,
    rarity: 3,
    weight: 100,
    featured: false,
    active: true,
    product: {
      id: item.id,
      name: item.name,
      collection: "",
      description: "",
      price_vnd: 0,
      item_code: item.id,
      quantity_available: 999,
      category: "souvenir",
      stock_status: "in_stock",
      stock_note: "",
      images: [fallbackImage],
      image_variants: [],
      featured: false,
      sort_order: 0,
      active: true,
    },
  }));
}
