import { useCallback, useEffect, useMemo, useState } from "react";
import { Layers3, LoaderCircle, WandSparkles } from "lucide-react";
import "../../styles/gacha-admin.css";
import {
  getAdminGachaConfiguration,
  publishGachaConfiguration,
  saveGachaDraft,
} from "../../lib/api";
import { getErrorMessage } from "../../lib/errors";
import { GACHA_GAME_TYPES, getGachaGameDescriptor } from "../../lib/gacha/gachaGames";
import {
  clearGachaLaunchCache,
  GACHA_PREVIEW_CONFIG_STORAGE_PREFIX,
} from "../../lib/gacha/gachaLaunch";
import {
  capGachaFeaturedEntries,
  matchesGachaBannerKind,
  normalizeGachaDisplayLimit,
} from "../../lib/gacha/gachaLimits";
import { usePlatformI18n } from "../../lib/i18n/platformI18n";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import type { Product } from "../../types/catalog";
import {
  defaultGachaBanner,
  type GachaBanner,
  type GachaGameType,
  type GachaLiveStatusesByGame,
  type GachaPoolEntry,
  type GachaSettings,
} from "../../types/gacha";
import { EmptyState } from "../ui/EmptyState";
import { useToast } from "../ui/ToastProvider";
import { AdminCard } from "./AdminCard";
import { GachaBannerEditor } from "./gacha/GachaBannerEditor";
import { GachaBannerList } from "./gacha/GachaBannerList";
import { GachaGeneralSection } from "./gacha/GachaGeneralSection";
import { GachaLuckSection } from "./gacha/GachaLuckSection";
import { GachaPoolEditor } from "./gacha/GachaPoolEditor";
import { GachaShared3StarEditor } from "./gacha/GachaShared3StarEditor";
import { GachaEditBar, GachaStatusBar } from "./gacha/GachaStatusBar";
import {
  createGameState,
  newEntry,
  persistedGameState,
  type GachaState,
  type GachaStatesByGame,
} from "./gacha/gachaState";
import { useGachaHistory } from "./gacha/useGachaHistory";

type Props = { shopId: string; shopSlug: string; products: Product[] };

export function GachaManager({ shopId, shopSlug, products }: Props) {
  const toast = useToast();
  const { t } = usePlatformI18n();
  const {
    activeGame,
    histories,
    loadAll,
    resetGame,
    switchGame,
    update,
    updateText,
    beginTextSession,
    undo,
    redo,
  } = useGachaHistory();
  const [baselines, setBaselines] = useState<GachaStatesByGame>({});
  const [liveByGame, setLiveByGame] = useState<GachaLiveStatusesByGame>({});
  const [loading, setLoading] = useState(true);
  const { busy: saving, run: runSave } = useAsyncAction();
  const { busy: publishing, run: runPublish } = useAsyncAction();
  const descriptor = getGachaGameDescriptor(activeGame);
  const history = histories[activeGame];
  const current = history.present;
  const settings = current?.settings ?? null;
  const banners = useMemo(() => current?.banners ?? [], [current?.banners]);
  const entries = useMemo(() => current?.entries ?? [], [current?.entries]);
  const selectedBannerId = current?.selectedBannerId ?? "";

  const dirtyByGame = useMemo(() => {
    const result = {} as Record<GachaGameType, boolean>;
    for (const gameType of GACHA_GAME_TYPES) {
      const present = histories[gameType].present;
      const baseline = baselines[gameType];
      if (!present || !baseline) {
        result[gameType] = Boolean(present || baseline);
        continue;
      }
      result[gameType] =
        JSON.stringify(persistedGameState(present)) !==
        JSON.stringify(persistedGameState(baseline));
    }
    return result;
  }, [histories, baselines]);
  const dirty = dirtyByGame[activeGame];

  const fetchWorkspace = useCallback(async () => {
    const next = await getAdminGachaConfiguration(shopId);
    const states = Object.fromEntries(
      GACHA_GAME_TYPES.map((gameType) => [
        gameType,
        createGameState(shopId, gameType, next.configurations[gameType]),
      ]),
    ) as Record<GachaGameType, GachaState>;
    return { states, liveByGame: next.liveByGame };
  }, [shopId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWorkspace()
      .then((workspace) => {
        if (cancelled) return;
        setBaselines(workspace.states);
        setLiveByGame(workspace.liveByGame);
        loadAll(
          workspace.states,
          GACHA_GAME_TYPES.find((gameType) => workspace.liveByGame[gameType]),
        );
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error(
          t(getErrorMessage(error, "Could not load the minigame.")),
          t("Gacha unavailable"),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchWorkspace, loadAll, t, toast]);

  useEffect(() => {
    if (
      loading ||
      !current ||
      !settings ||
      !dirty ||
      saving ||
      publishing ||
      !settings.title.trim() ||
      banners.some((banner) => !banner.name.trim())
    ) {
      return;
    }

    const gameType = activeGame;
    const snapshot = persistedGameState(current);
    const timer = window.setTimeout(() => {
      void runSave(async () => {
        const saved = await saveGachaDraft(shopId, gameType, snapshot);
        const savedState = createGameState(shopId, gameType, saved);
        setBaselines((curr) => ({ ...curr, [gameType]: savedState }));
      }).catch(() => {
        // Keep the dirty state visible; the next edit retries autosave.
      });
    }, 900);

    return () => window.clearTimeout(timer);
  }, [
    activeGame,
    banners,
    current,
    dirty,
    loading,
    publishing,
    runSave,
    saving,
    settings,
    shopId,
  ]);

  function validateBasics(state: GachaState): boolean {
    const { settings: stateSettings, banners: stateBanners } = state;
    if (
      !stateSettings.title.trim() ||
      stateBanners.some((banner) => !banner.name.trim())
    ) {
      toast.error(
        t("Give the minigame and every banner a title."),
        t("Check gacha settings"),
      );
      return false;
    }
    if (
      stateSettings.rare_base_rate + stateSettings.legendary_base_rate >=
      100
    ) {
      toast.error(
        t("The 4-star and 5-star base rates must total less than 100%."),
        t("Check gacha settings"),
      );
      return false;
    }
    if (
      descriptor.hasLightconePity &&
      stateSettings.rare_base_rate +
        stateSettings.lightcone_legendary_base_rate >=
        100
    ) {
      toast.error(
        t(
          "The 4-star and Light Cone 5-star base rates must total less than 100%.",
        ),
        t("Check warp settings"),
      );
      return false;
    }
    if (stateSettings.legendary_pity <= stateSettings.rare_pity) {
      toast.error(
        t("The 5-star pity must be higher than the 4-star pity."),
        t("Check gacha settings"),
      );
      return false;
    }
    if (
      descriptor.hasLightconePity &&
      stateSettings.lightcone_legendary_pity <= stateSettings.rare_pity
    ) {
      toast.error(
        t("The Light Cone 5-star pity must be higher than the 4-star pity."),
        t("Check warp settings"),
      );
      return false;
    }
    if (
      stateSettings.rare_soft_pity < 1 ||
      stateSettings.rare_soft_pity >= stateSettings.rare_pity ||
      stateSettings.legendary_soft_pity < 1 ||
      stateSettings.legendary_soft_pity >= stateSettings.legendary_pity ||
      (descriptor.hasLightconePity &&
        (stateSettings.lightcone_legendary_soft_pity < 1 ||
          stateSettings.lightcone_legendary_soft_pity >=
            stateSettings.lightcone_legendary_pity))
    ) {
      toast.error(
        t("Each soft pity must be at least 1 and lower than its hard pity."),
        t("Check gacha settings"),
      );
      return false;
    }
    if (
      stateSettings.featured_item_rate < 0 ||
      stateSettings.featured_item_rate > 100
    ) {
      toast.error(
        t("The featured-item rate must be between 0% and 100%."),
        t("Check gacha settings"),
      );
      return false;
    }
    const invalidSchedule = stateBanners.find((banner) => {
      if (!banner.starts_at || !banner.ends_at) return false;
      return Date.parse(banner.ends_at) <= Date.parse(banner.starts_at);
    });
    if (invalidSchedule) {
      toast.error(
        t('Banner "{{name}}" must end after it starts.', {
          name: invalidSchedule.name,
        }),
        t("Check banner schedule"),
      );
      return false;
    }
    return true;
  }

  function validateGoLive(state: GachaState): boolean {
    const {
      settings: stateSettings,
      banners: stateBanners,
      entries: stateEntries,
    } = state;
    if (!stateSettings.enabled) return true;
    const activeBanners = stateBanners.filter((banner) => banner.active);
    if (activeBanners.length === 0) {
      toast.error(
        t("Enable at least one banner before publishing the minigame."),
        t("No active banner"),
      );
      return false;
    }
    const emptyBanner = activeBanners.find(
      (banner) =>
        !stateEntries.some(
          (entry) => entry.banner_id === banner.id && entry.active,
        ),
    );
    if (emptyBanner) {
      toast.error(
        t(
          'The active banner "{{name}}" needs at least one active merch item.',
          { name: emptyBanner.name },
        ),
        t("Wish pool is empty"),
      );
      return false;
    }
    const activeBannerIds = new Set(activeBanners.map((banner) => banner.id));
    const activeRarities = new Set(
      stateEntries
        .filter((entry) => entry.active && activeBannerIds.has(entry.banner_id))
        .map((entry) => entry.rarity),
    );
    // 3-star pulls fall back to the shared souvenir pool (see migration
    // 20260720080000_allow_gacha_publish_without_3star.sql), so only 4- and
    // 5-star items are required here, matching the server-side check.
    const missingRarity = ([4, 5] as const).find(
      (rarity) => !activeRarities.has(rarity),
    );
    if (missingRarity) {
      toast.error(
        t(
          "The active game needs at least one active {{rarity}}-star item across its banners.",
          { rarity: missingRarity },
        ),
        t("Incomplete prize pool"),
      );
      return false;
    }

    const rule = descriptor.featuredRule;
    if (rule.kind === "primary-secondary") {
      const offendingBanner = activeBanners.find((banner) => {
        // If the banner has zero featured entries of any rarity, it is a standard banner
        // and does not require a featured 5-star item.
        const bannerEntries = stateEntries.filter(
          (entry) => entry.banner_id === banner.id && entry.active,
        );
        const hasAnyFeatured = bannerEntries.some((entry) => entry.featured);
        if (!hasAnyFeatured) return false;

        const primaryFeaturedCount = bannerEntries.filter(
          (entry) =>
            entry.featured &&
            entry.rarity === 5 &&
            matchesGachaBannerKind(entry, banner),
        ).length;
        return primaryFeaturedCount !== rule.primaryLimit;
      });
      if (offendingBanner) {
        toast.error(
          t(
            'The active banner "{{name}}" needs exactly one featured 5-star item.',
            { name: offendingBanner.name },
          ),
          t("Check warp settings"),
        );
        return false;
      }
    }
    return true;
  }

  async function publish() {
    if (!current || !validateBasics(current) || !validateGoLive(current))
      return;
    const config = persistedGameState(current);
    let published = false;
    await runPublish(async () => {
      const saved = await publishGachaConfiguration(shopId, activeGame, config);
      // Reset only the published game — the other game may hold unsaved
      // edits and its own undo stack, which a full reload would discard.
      const publishedState = createGameState(shopId, activeGame, saved);
      setBaselines((curr) => ({ ...curr, [activeGame]: publishedState }));
      resetGame(activeGame, publishedState);
      // The RPC wrote exactly this configuration, so live status can be
      // derived locally without another round trip.
      setLiveByGame((curr) => ({
        ...curr,
        [activeGame]: {
          settings: saved.settings,
          bannerCount: saved.banners.filter((banner) => banner.active).length,
          entryCount: saved.entries.filter((entry) => entry.active).length,
        },
      }));
      clearGachaLaunchCache(shopSlug);
      published = true;
    }).catch((error: unknown) => {
      toast.error(
        t(getErrorMessage(error, "Could not save the minigame.")),
        t("Could not publish gacha"),
      );
    });
    if (published) toast.success(t("Gacha settings published."));
  }

  async function resetCurrentGame() {
    try {
      const next = await getAdminGachaConfiguration(shopId);
      const fresh = createGameState(
        shopId,
        activeGame,
        next.configurations[activeGame],
      );
      setLiveByGame(next.liveByGame);
      setBaselines((curr) => ({ ...curr, [activeGame]: fresh }));
      resetGame(activeGame, fresh);
    } catch (error) {
      toast.error(
        t(getErrorMessage(error, "Could not load the minigame.")),
        t("Gacha unavailable"),
      );
    }
  }

  async function discardCurrentGame() {
    if (!window.confirm(t("Discard all unpublished changes for this game?")))
      return;
    await resetCurrentGame();
  }

  const updateSettings = useCallback(
    (changes: Partial<GachaSettings>, asTextEdit = false) => {
      const updater = (curr: GachaState): GachaState => ({
        ...curr,
        settings: { ...curr.settings, ...changes },
      });
      if (asTextEdit) updateText(updater);
      else update(updater, true);
    },
    [update, updateText],
  );

  function applyRecommendedSetup() {
    if (!current || entries.length > 0) return;
    const availableProducts = products.filter((product) => product.active);
    if (availableProducts.length < 3) {
      toast.info(
        t(
          "Add at least three active products so the pool can include 3-star, 4-star, and 5-star rewards.",
        ),
        t("More merch needed"),
      );
      return;
    }
    const banner = banners[0];
    update(
      (state) => ({
        ...state,
        settings: { ...state.settings, enabled: true },
        selectedBannerId: banner.id,
        entries: availableProducts.map((product, index) => ({
          ...newEntry(shopId, banner.id, product.id, banner.kind, activeGame),
          rarity: index === 0 ? 5 : index === 1 ? 4 : 3,
          featured: index === 0,
        })),
      }),
      true,
    );
    toast.success(
      t("Recommended pool created. Review it, then publish when ready."),
    );
  }

  const updateBanner = useCallback(
    (changes: Partial<GachaBanner>) => {
      const isTextChange = "name" in changes || "description" in changes;
      const updater = (curr: GachaState): GachaState => ({
        ...curr,
        banners: curr.banners.map((banner) =>
          banner.id === curr.selectedBannerId
            ? { ...banner, ...changes }
            : banner,
        ),
      });
      if (isTextChange) updateText(updater);
      else update(updater, true);
    },
    [update, updateText],
  );

  const setSelectedBannerId = useCallback(
    (id: string) => {
      update((curr) => ({ ...curr, selectedBannerId: id }), false);
    },
    [update],
  );

  const updateDisplayLimit = useCallback(
    (displayLimit: number) => {
      const normalizedLimit = normalizeGachaDisplayLimit(
        displayLimit,
        activeGame,
      );
      update((curr) => {
        const nextBanners = curr.banners.map((banner) =>
          banner.id === curr.selectedBannerId
            ? { ...banner, display_limit: normalizedLimit }
            : banner,
        );
        return {
          ...curr,
          banners: nextBanners,
          entries: capGachaFeaturedEntries(
            curr.entries,
            nextBanners,
            activeGame,
          ),
        };
      }, true);
    },
    [activeGame, update],
  );

  const selectedBanner = useMemo(
    () => banners.find((banner) => banner.id === selectedBannerId) ?? null,
    [banners, selectedBannerId],
  );

  const bannerIndex = useMemo(
    () => banners.findIndex((banner) => banner.id === selectedBannerId),
    [banners, selectedBannerId],
  );

  const addBanner = useCallback(
    (source?: GachaBanner) => {
      const { defaults } = descriptor;
      const banner: GachaBanner = {
        ...(source ?? defaultGachaBanner(shopId)),
        id: crypto.randomUUID(),
        name: source ? `${source.name} copy` : `Banner ${banners.length + 1}`,
        theme: source?.theme ?? defaults.bannerTheme,
        display_limit: normalizeGachaDisplayLimit(
          source?.display_limit ?? defaults.displayLimit,
          activeGame,
        ),
        sort_order: banners.length,
      };
      update(
        (curr) => ({
          ...curr,
          banners: [...curr.banners, banner],
          selectedBannerId: banner.id,
        }),
        true,
      );
      if (source) {
        toast.info(
          t(
            "Pool items are not copied — each merch item can only belong to one banner.",
          ),
          t("Banner duplicated"),
        );
      }
    },
    [activeGame, banners.length, descriptor, shopId, t, toast, update],
  );

  const removeBanner = useCallback(() => {
    if (!selectedBanner || banners.length === 1) return;
    const confirmed = window.confirm(
      t("Delete banner “{{name}}”? Its pool items will be removed too.", {
        name: selectedBanner.name,
      }),
    );
    if (!confirmed) return;
    update((curr) => {
      const next = curr.banners.filter(
        (banner) => banner.id !== selectedBanner.id,
      );
      return {
        ...curr,
        banners: next,
        entries: curr.entries.filter(
          (entry) => entry.banner_id !== selectedBanner.id,
        ),
        selectedBannerId: next[0]?.id ?? "",
      };
    }, true);
  }, [banners.length, selectedBanner, t, update]);

  const moveBanner = useCallback(
    (delta: number) => {
      update((curr) => {
        const index = curr.banners.findIndex(
          (b) => b.id === curr.selectedBannerId,
        );
        const target = index + delta;
        if (index < 0 || target < 0 || target >= curr.banners.length)
          return curr;
        const next = [...curr.banners];
        [next[index], next[target]] = [next[target], next[index]];
        return {
          ...curr,
          banners: next.map((banner, sort_order) => ({
            ...banner,
            sort_order,
          })),
        };
      }, true);
    },
    [update],
  );

  const selectedEntries = useMemo(
    () => entries.filter((entry) => entry.banner_id === selectedBannerId),
    [entries, selectedBannerId],
  );

  const entriesByProduct = useMemo(
    () => new Map(selectedEntries.map((entry) => [entry.product_id, entry])),
    [selectedEntries],
  );

  const assignedBannerByProduct = useMemo(() => {
    const map = new Map<string, GachaBanner>();
    for (const entry of entries) {
      if (map.has(entry.product_id)) continue;
      const owner = banners.find((banner) => banner.id === entry.banner_id);
      if (owner) map.set(entry.product_id, owner);
    }
    return map;
  }, [banners, entries]);

  const activeEntries = useMemo(
    () => selectedEntries.filter((entry) => entry.active),
    [selectedEntries],
  );

  const featuredCount = useMemo(
    () => activeEntries.filter((entry) => entry.featured).length,
    [activeEntries],
  );

  const toggleProduct = useCallback(
    (productId: string) => {
      if (!selectedBanner) return;
      const isIncluded = entriesByProduct.has(productId);
      if (!isIncluded) {
        const owner = assignedBannerByProduct.get(productId);
        if (owner && owner.id !== selectedBanner.id) {
          toast.info(
            t("This item is already in “{{banner}}”. Remove it there first.", {
              banner: owner.name,
            }),
            t("Already in another banner"),
          );
          return;
        }
      }
      update((curr) => {
        const exists = curr.entries.some(
          (entry) =>
            entry.banner_id === selectedBanner.id &&
            entry.product_id === productId,
        );
        return {
          ...curr,
          entries: exists
            ? curr.entries.filter(
                (entry) =>
                  !(
                    entry.banner_id === selectedBanner.id &&
                    entry.product_id === productId
                  ),
              )
            : [
                ...curr.entries,
                newEntry(
                  shopId,
                  selectedBanner.id,
                  productId,
                  selectedBanner.kind,
                  activeGame,
                ),
              ],
        };
      }, true);
      toast.success(t(isIncluded ? "Removed from pool." : "Added to pool."));
    },
    [
      activeGame,
      assignedBannerByProduct,
      entriesByProduct,
      selectedBanner,
      shopId,
      t,
      toast,
      update,
    ],
  );

  const updateEntry = useCallback(
    (productId: string, changes: Partial<GachaPoolEntry>) => {
      const isTextChange = "weight" in changes;
      const updater = (curr: GachaState): GachaState => ({
        ...curr,
        entries: curr.entries.map((entry) =>
          entry.banner_id === curr.selectedBannerId &&
          entry.product_id === productId
            ? { ...entry, ...changes }
            : entry,
        ),
      });
      if (isTextChange) updateText(updater);
      else update(updater, true);
    },
    [update, updateText],
  );

  const updateFeatured = useCallback(
    (productId: string, featured: boolean) => {
      const entry = entriesByProduct.get(productId);
      if (!entry || !selectedBanner) return;
      const rule = descriptor.featuredRule;
      if (featured && rule.kind === "primary-secondary") {
        if (!matchesGachaBannerKind(entry, selectedBanner)) {
          toast.info(
            t("Featured items must match the HSR banner type."),
            t("Choose a matching role"),
          );
          return;
        }
        if (entry.rarity === 3) {
          toast.info(
            t(
              "Only 5-star primary and 4-star secondary items can be featured.",
            ),
            t("Choose a featured rarity"),
          );
          return;
        }
        const sameRarityCount = activeEntries.filter(
          (c) => c.featured && c.rarity === entry.rarity,
        ).length;
        const rarityLimit =
          entry.rarity === 5
            ? rule.primaryLimit
            : Math.min(
                rule.secondaryLimit,
                Math.max(0, selectedBanner.display_limit - rule.primaryLimit),
              );
        if (sameRarityCount >= rarityLimit) {
          toast.info(
            t(
              entry.rarity === 5
                ? "HSR banners support one primary 5-star item."
                : "This HSR banner has filled its 4-star rate-up slots.",
            ),
            t("Featured slots are full"),
          );
          return;
        }
      }
      if (featured && featuredCount >= selectedBanner.display_limit) {
        toast.info(
          t("This banner can show up to {{count}} featured items.", {
            count: selectedBanner.display_limit,
          }),
          t("Featured slots are full"),
        );
        return;
      }
      updateEntry(productId, {
        featured,
        active: featured ? true : entry.active,
      });
    },
    [
      activeEntries,
      descriptor.featuredRule,
      entriesByProduct,
      featuredCount,
      selectedBanner,
      t,
      toast,
      updateEntry,
    ],
  );

  function openPreview() {
    if (!current) return;
    const productsById = new Map(
      products.map((product) => [product.id, product]),
    );
    const previewEntries = capGachaFeaturedEntries(
      current.entries,
      current.banners,
      activeGame,
    ).flatMap((entry) => {
      const product = productsById.get(entry.product_id);
      return product && entry.active ? [{ ...entry, product }] : [];
    });
    localStorage.setItem(
      `${GACHA_PREVIEW_CONFIG_STORAGE_PREFIX}${shopSlug}:${activeGame}`,
      JSON.stringify({
        settings: current.settings,
        banners: current.banners,
        entries: previewEntries,
      }),
    );
    window.open(
      `/s/${shopSlug}/play?preview=1&game=${activeGame}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement ||
          target.isContentEditable)
      ) {
        return;
      }
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifier = isMac ? event.metaKey : event.ctrlKey;
      if (!modifier || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (key === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  const statusGames = useMemo(
    () =>
      GACHA_GAME_TYPES.map((gameType) => ({
        gameType,
        label: getGachaGameDescriptor(gameType).label,
        dirty: dirtyByGame[gameType],
        isLive: Boolean(liveByGame[gameType]),
      })),
    [dirtyByGame, liveByGame],
  );

  const toggleShared3StarProduct = useCallback(
    (productId: string) => {
      if (!selectedBanner) return;
      update((curr) => {
        const exists = curr.entries.some(
          (entry) => entry.product_id === productId,
        );
        if (exists) {
          return {
            ...curr,
            entries: curr.entries.filter(
              (entry) => entry.product_id !== productId,
            ),
          };
        }
        const entry = {
          ...newEntry(
            shopId,
            selectedBanner.id,
            productId,
            selectedBanner.kind,
            activeGame,
          ),
          rarity: 3 as const,
        };
        return {
          ...curr,
          entries: [...curr.entries, entry],
        };
      }, true);
    },
    [activeGame, selectedBanner, shopId, update],
  );

  if (loading || !current || !settings || !selectedBanner) {
    return (
      <EmptyState
        tone="loading"
        icon={<LoaderCircle className="state-spinner" size={28} />}
        title={t("Loading gacha settings…")}
        message={t("Preparing the shop’s merch banners.")}
      />
    );
  }

  return (
    <div className="gacha-admin-page">
      <GachaStatusBar
        games={statusGames}
        activeGame={activeGame}
        currentLive={liveByGame[activeGame] ?? null}
        hasPublished={Object.keys(liveByGame).length > 0}
        onSwitchGame={switchGame}
        onPreview={openPreview}
      />
      {entries.length === 0 && (
        <AdminCard
          className="gacha-quick-setup"
          icon={<WandSparkles size={18} />}
          title={t("Quick setup")}
          description={t(
            "Create a playable pool from your active merch, using safe recommended defaults. Everything remains editable and undoable.",
          )}
        >
          <button
            type="button"
            className="button button-primary"
            onClick={applyRecommendedSetup}
          >
            <WandSparkles size={17} /> {t("Use recommended setup")}
          </button>
        </AdminCard>
      )}
      <GachaGeneralSection
        settings={settings}
        onUpdateSettings={updateSettings}
        onTextFocus={beginTextSession}
      />
      <AdminCard
        className="gacha-banners-card"
        icon={<Layers3 size={18} />}
        title={t("2 · Prizes & banners")}
        description={t(
          "Choose one banner, then manage its prizes without leaving this card.",
        )}
      >
        <GachaBannerList
          banners={banners}
          entries={entries}
          selectedBannerId={selectedBannerId}
          canMoveUp={bannerIndex > 0}
          canMoveDown={bannerIndex >= 0 && bannerIndex < banners.length - 1}
          canDelete={banners.length > 1}
          onSelect={setSelectedBannerId}
          onAdd={() => addBanner()}
          onDuplicate={() => addBanner(selectedBanner)}
          onDelete={removeBanner}
          onMove={moveBanner}
        />
        <GachaBannerEditor
          banner={selectedBanner}
          descriptor={descriptor}
          onUpdateBanner={updateBanner}
          onUpdateDisplayLimit={updateDisplayLimit}
          onTextFocus={beginTextSession}
        />
        <GachaPoolEditor
          products={products}
          banner={selectedBanner}
          banners={banners}
          entries={entries}
          descriptor={descriptor}
          onToggleProduct={toggleProduct}
          onUpdateEntry={updateEntry}
          onToggleFeatured={updateFeatured}
          onTextFocus={beginTextSession}
          sharedCount={entries.filter((entry) => entry.rarity === 3).length}
          sharedPool={
            <GachaShared3StarEditor
              products={products}
              entries={entries}
              onToggleProduct={toggleShared3StarProduct}
            />
          }
        />
      </AdminCard>
      <GachaLuckSection
        settings={settings}
        descriptor={descriptor}
        onUpdateSettings={updateSettings}
        onTextFocus={beginTextSession}
      />
      <GachaEditBar
        dirty={dirty}
        saving={saving}
        publishing={publishing}
        onReset={() => void discardCurrentGame()}
        onPublish={() => void publish()}
      />
    </div>
  );
}
