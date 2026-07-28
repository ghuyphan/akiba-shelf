import {
  getGachaBannerFeaturedRule,
  getGachaGameDescriptor,
} from "../../../lib/gacha/gachaGames";
import {
  getGachaFeaturedComposition,
  hasGachaBannerRarities,
  isGachaFeaturedCompositionComplete,
} from "../../../lib/gacha/gachaLimits";
import type { GachaGameType } from "../../../types/gacha";
import type { GachaState } from "./gachaState";

export type GachaValidationIssue = {
  message: string;
  target: "general" | "banner" | "pool" | "luck";
  field?: "title" | "schedule";
  bannerId?: string;
};

type Variables = Record<string, string | number>;
type Translate = (english: string, variables?: Variables) => string;

export type GachaValidationResult = {
  issue: GachaValidationIssue;
  title: string;
};

export function validateGachaBasics(
  state: GachaState,
  gameType: GachaGameType,
  t: Translate,
): GachaValidationResult | null {
  const { settings, banners } = state;
  const descriptor = getGachaGameDescriptor(gameType);
  const result = (issue: GachaValidationIssue, title: string) => ({
    issue,
    title,
  });

  if (!settings.title.trim()) {
    return result(
      {
        message: t("Give the minigame a title."),
        target: "general",
        field: "title",
      },
      t("Check gacha settings"),
    );
  }
  const untitledBanner = banners.find((banner) => !banner.name.trim());
  if (untitledBanner) {
    return result(
      {
        message: t("Give every banner a title."),
        target: "banner",
        field: "title",
        bannerId: untitledBanner.id,
      },
      t("Check gacha settings"),
    );
  }
  if (settings.rare_base_rate + settings.legendary_base_rate >= 100) {
    return result(
      {
        message: t(
          "The 4-star and 5-star base rates must total less than 100%.",
        ),
        target: "luck",
      },
      t("Check gacha settings"),
    );
  }
  if (
    descriptor.hasLightconePity &&
    settings.rare_base_rate + settings.lightcone_legendary_base_rate >= 100
  ) {
    return result(
      {
        message: t(
          "The 4-star and Light Cone 5-star base rates must total less than 100%.",
        ),
        target: "luck",
      },
      t("Check warp settings"),
    );
  }
  if (settings.legendary_pity <= settings.rare_pity) {
    return result(
      {
        message: t("The 5-star pity must be higher than the 4-star pity."),
        target: "luck",
      },
      t("Check gacha settings"),
    );
  }
  if (
    descriptor.hasLightconePity &&
    settings.lightcone_legendary_pity <= settings.rare_pity
  ) {
    return result(
      {
        message: t(
          "The Light Cone 5-star pity must be higher than the 4-star pity.",
        ),
        target: "luck",
      },
      t("Check warp settings"),
    );
  }
  if (
    settings.rare_soft_pity < 1 ||
    settings.rare_soft_pity >= settings.rare_pity ||
    settings.legendary_soft_pity < 1 ||
    settings.legendary_soft_pity >= settings.legendary_pity ||
    (descriptor.hasLightconePity &&
      (settings.lightcone_legendary_soft_pity < 1 ||
        settings.lightcone_legendary_soft_pity >=
          settings.lightcone_legendary_pity))
  ) {
    return result(
      {
        message: t(
          "Each soft pity must be at least 1 and lower than its hard pity.",
        ),
        target: "luck",
      },
      t("Check gacha settings"),
    );
  }
  if (settings.featured_item_rate < 0 || settings.featured_item_rate > 100) {
    return result(
      {
        message: t("The featured-item rate must be between 0% and 100%."),
        target: "luck",
      },
      t("Check gacha settings"),
    );
  }
  const invalidSchedule = banners.find((banner) => {
    if (!banner.starts_at || !banner.ends_at) return false;
    return Date.parse(banner.ends_at) <= Date.parse(banner.starts_at);
  });
  if (invalidSchedule) {
    return result(
      {
        message: t('Banner "{{name}}" must end after it starts.', {
          name: invalidSchedule.name,
        }),
        target: "banner",
        field: "schedule",
        bannerId: invalidSchedule.id,
      },
      t("Check banner schedule"),
    );
  }
  return null;
}

export function validateGachaGoLive(
  state: GachaState,
  gameType: GachaGameType,
  t: Translate,
): GachaValidationResult | null {
  const { settings, banners, entries } = state;
  if (!settings.enabled) return null;
  const result = (issue: GachaValidationIssue, title: string) => ({
    issue,
    title,
  });
  const activeBanners = banners.filter((banner) => banner.active);
  if (activeBanners.length === 0) {
    return result(
      {
        message: t(
          "Enable at least one banner before publishing the minigame.",
        ),
        target: "banner",
      },
      t("No active banner"),
    );
  }
  const emptyBanner = activeBanners.find(
    (banner) =>
      !entries.some((entry) => entry.banner_id === banner.id && entry.active),
  );
  if (emptyBanner) {
    return result(
      {
        message: t(
          'The active banner "{{name}}" needs at least one active merch item.',
          {
            name: emptyBanner.name,
          },
        ),
        target: "pool",
        bannerId: emptyBanner.id,
      },
      t("Wish pool is empty"),
    );
  }

  const activeBannerIds = new Set(activeBanners.map((banner) => banner.id));
  const activeRarities = new Set(
    entries
      .filter((entry) => entry.active && activeBannerIds.has(entry.banner_id))
      .map((entry) => entry.rarity),
  );
  // 3-star pulls use the shared souvenir pool; the publish contract only
  // requires active 4-star and 5-star entries here.
  const missingRarity = ([4, 5] as const).find(
    (rarity) => !activeRarities.has(rarity),
  );
  if (missingRarity) {
    return result(
      {
        message: t(
          "The active game needs at least one active {{rarity}}-star item across its banners.",
          { rarity: missingRarity },
        ),
        target: "pool",
      },
      t("Incomplete prize pool"),
    );
  }

  for (const banner of activeBanners) {
    const rule = getGachaBannerFeaturedRule(gameType, banner.kind);
    const composition = getGachaFeaturedComposition(entries, banner);
    if (composition.invalidCount > 0) {
      return result(
        {
          message: t(
            'Featured items in "{{name}}" must match its banner type and use 4★ or 5★ rarity.',
            { name: banner.name },
          ),
          target: "pool",
          bannerId: banner.id,
        },
        t("Check featured items"),
      );
    }
    if (composition.totalCount === 0 && rule.allowEmptyComposition) {
      if (!hasGachaBannerRarities(entries, banner, false)) {
        return result(
          {
            message: t(
              'The standard banner "{{name}}" needs active non-featured 4★ and 5★ items.',
              { name: banner.name },
            ),
            target: "pool",
            bannerId: banner.id,
          },
          t("Incomplete standard pool"),
        );
      }
      continue;
    }
    if (
      rule.requireCompleteComposition &&
      !isGachaFeaturedCompositionComplete(entries, banner, gameType)
    ) {
      return result(
        {
          message: t(
            'The active banner "{{name}}" needs exactly {{five}} featured 5★ and {{four}} featured 4★ items.',
            {
              name: banner.name,
              five: rule.fiveStarLimit,
              four: rule.fourStarLimit,
            },
          ),
          target: "pool",
          bannerId: banner.id,
        },
        t("Incomplete featured lineup"),
      );
    }
    if (
      !rule.requireCompleteComposition &&
      composition.totalCount > 0 &&
      (composition.fiveStarCount !== rule.fiveStarLimit ||
        composition.fourStarCount > rule.fourStarLimit)
    ) {
      return result(
        {
          message: t(
            'The active banner "{{name}}" supports {{five}} featured 5★ and up to {{four}} featured 4★ items.',
            {
              name: banner.name,
              five: rule.fiveStarLimit,
              four: rule.fourStarLimit,
            },
          ),
          target: "pool",
          bannerId: banner.id,
        },
        t("Check warp settings"),
      );
    }
    if (
      settings.featured_item_rate < 100 &&
      !hasGachaBannerRarities(entries, banner, false)
    ) {
      return result(
        {
          message: t(
            'The active banner "{{name}}" needs non-featured 4★ and 5★ items for possible featured-rate losses.',
            { name: banner.name },
          ),
          target: "pool",
          bannerId: banner.id,
        },
        t("Missing loss candidates"),
      );
    }
  }
  return null;
}
