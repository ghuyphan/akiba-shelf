import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layers3, LoaderCircle, RefreshCw, WandSparkles } from "lucide-react";
import "../../styles/gacha-admin.css";
import {
  getAdminGachaConfiguration,
  publishGachaConfiguration,
  saveGachaDraft,
} from "../../lib/api";
import { getErrorMessage } from "../../lib/errors";
import {
  GACHA_GAME_TYPES,
  getGachaBannerFeaturedRule,
  getGachaGameDescriptor,
} from "../../lib/gacha/gachaGames";
import {
  clearGachaLaunchCache,
  GACHA_PREVIEW_CONFIG_STORAGE_PREFIX,
} from "../../lib/gacha/gachaLaunch";
import {
  capGachaFeaturedEntries,
  getGachaFeaturedComposition,
  getRecommendedGachaEntryPlan,
  hasGachaBannerRarities,
  isGachaFeaturedCompositionComplete,
  matchesGachaBannerKind,
  normalizeGachaDisplayLimit,
} from "../../lib/gacha/gachaLimits";
import { usePlatformI18n } from "../../lib/i18n/platformI18n";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import type { Product } from "../../types/catalog";
import {
  defaultGachaBanner,
  type GachaBanner,
  type GachaGameConfiguration,
  type GachaGameType,
  type GachaLiveStatusesByGame,
  type GachaPoolEntry,
  type GachaSettings,
} from "../../types/gacha";
import { EmptyState } from "../ui/EmptyState";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { ConfirmationDialog } from "../ui/ConfirmationDialog";
import { useToast } from "../ui/ToastProvider";
import { AdminCard } from "./AdminCard";
import { useAdminUnsavedChanges } from "./AdminUnsavedChanges";
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

type ValidationIssue = {
  message: string;
  target: "general" | "banner" | "pool" | "luck";
  field?: "title" | "schedule";
  bannerId?: string;
};

type ConfirmationState =
  | { type: "discard" }
  | { type: "delete-banner"; bannerId: string; bannerName: string }
  | { type: "publish-switch" }
  | null;

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
  const [loadError, setLoadError] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [autosaveError, setAutosaveError] = useState<{
    message: string;
    snapshotKey: string;
    gameType: GachaGameType;
    snapshot: GachaGameConfiguration;
  } | null>(null);
  const [publishError, setPublishError] = useState("");
  const [validationIssue, setValidationIssue] =
    useState<ValidationIssue | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState>(null);
  const validationFocusFrame = useRef<number | null>(null);
  const { busy: saving, run: runSave } = useAsyncAction();
  const { busy: publishing, run: runPublish } = useAsyncAction();
  const { busy: resetting, run: runReset } = useAsyncAction();
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
  const hasAnyDirtyGame = GACHA_GAME_TYPES.some(
    (gameType) => dirtyByGame[gameType],
  );
  const discardAllLocalChanges = useCallback(() => {
    for (const gameType of GACHA_GAME_TYPES) {
      const baseline = baselines[gameType];
      if (baseline) resetGame(gameType, baseline);
    }
    setAutosaveError(null);
    setPublishError("");
    setValidationIssue(null);
  }, [baselines, resetGame]);
  useAdminUnsavedChanges(
    `gacha:${shopId}`,
    hasAnyDirtyGame,
    discardAllLocalChanges,
  );

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
    setLoadError("");
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
        setLoadError(t(getErrorMessage(error, "Could not load the minigame.")));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchWorkspace, loadAll, reloadNonce, t]);

  useEffect(
    () => () => {
      if (validationFocusFrame.current !== null) {
        window.cancelAnimationFrame(validationFocusFrame.current);
      }
    },
    [],
  );

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
    const snapshotKey = JSON.stringify(snapshot);
    if (
      autosaveError?.gameType === gameType &&
      autosaveError.snapshotKey === snapshotKey
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      void runSave(async () => {
        const saved = await saveGachaDraft(shopId, gameType, snapshot);
        const savedState = createGameState(shopId, gameType, saved);
        setBaselines((curr) => ({ ...curr, [gameType]: savedState }));
        setAutosaveError(null);
      }).catch((error: unknown) => {
        setAutosaveError({
          message: t(getErrorMessage(error, "Could not save draft")),
          snapshotKey,
          gameType,
          snapshot,
        });
      });
    }, 900);

    return () => window.clearTimeout(timer);
  }, [
    activeGame,
    autosaveError,
    banners,
    current,
    dirty,
    loading,
    publishing,
    runSave,
    saving,
    settings,
    shopId,
    t,
  ]);

  const focusValidationIssue = useCallback(
    (issue: ValidationIssue) => {
      if (issue.bannerId && issue.bannerId !== selectedBannerId) {
        update(
          (state) => ({ ...state, selectedBannerId: issue.bannerId! }),
          false,
        );
      }
      if (validationFocusFrame.current !== null) {
        window.cancelAnimationFrame(validationFocusFrame.current);
      }
      validationFocusFrame.current = window.requestAnimationFrame(() => {
        const section = document.getElementById(
          `gacha-validation-${issue.target}`,
        );
        if (!section) return;
        const disclosure = section.querySelector<HTMLDetailsElement>("details");
        if (disclosure) disclosure.open = true;
        section.scrollIntoView({ behavior: "smooth", block: "center" });
        const field =
          section.querySelector<HTMLElement>('[aria-invalid="true"]') ??
          section.querySelector<HTMLElement>(
            "input:not([disabled]), textarea:not([disabled]), summary, button:not([disabled])",
          );
        field?.focus({ preventScroll: true });
      });
    },
    [selectedBannerId, update],
  );

  const reportValidationIssue = useCallback(
    (issue: ValidationIssue, title: string) => {
      setValidationIssue(issue);
      setPublishError("");
      toast.error(issue.message, title);
      return false;
    },
    [toast],
  );

  useEffect(() => {
    if (validationIssue) focusValidationIssue(validationIssue);
  }, [focusValidationIssue, validationIssue]);

  function validateBasics(state: GachaState): boolean {
    const { settings: stateSettings, banners: stateBanners } = state;
    if (!stateSettings.title.trim()) {
      return reportValidationIssue(
        {
          message: t("Give the minigame a title."),
          target: "general",
          field: "title",
        },
        t("Check gacha settings"),
      );
    }
    const untitledBanner = stateBanners.find((banner) => !banner.name.trim());
    if (untitledBanner) {
      return reportValidationIssue(
        {
          message: t("Give every banner a title."),
          target: "banner",
          field: "title",
          bannerId: untitledBanner.id,
        },
        t("Check gacha settings"),
      );
    }
    if (
      stateSettings.rare_base_rate + stateSettings.legendary_base_rate >=
      100
    ) {
      return reportValidationIssue(
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
      stateSettings.rare_base_rate +
        stateSettings.lightcone_legendary_base_rate >=
        100
    ) {
      return reportValidationIssue(
        {
          message: t(
            "The 4-star and Light Cone 5-star base rates must total less than 100%.",
          ),
          target: "luck",
        },
        t("Check warp settings"),
      );
    }
    if (stateSettings.legendary_pity <= stateSettings.rare_pity) {
      return reportValidationIssue(
        {
          message: t("The 5-star pity must be higher than the 4-star pity."),
          target: "luck",
        },
        t("Check gacha settings"),
      );
    }
    if (
      descriptor.hasLightconePity &&
      stateSettings.lightcone_legendary_pity <= stateSettings.rare_pity
    ) {
      return reportValidationIssue(
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
      stateSettings.rare_soft_pity < 1 ||
      stateSettings.rare_soft_pity >= stateSettings.rare_pity ||
      stateSettings.legendary_soft_pity < 1 ||
      stateSettings.legendary_soft_pity >= stateSettings.legendary_pity ||
      (descriptor.hasLightconePity &&
        (stateSettings.lightcone_legendary_soft_pity < 1 ||
          stateSettings.lightcone_legendary_soft_pity >=
            stateSettings.lightcone_legendary_pity))
    ) {
      return reportValidationIssue(
        {
          message: t(
            "Each soft pity must be at least 1 and lower than its hard pity.",
          ),
          target: "luck",
        },
        t("Check gacha settings"),
      );
    }
    if (
      stateSettings.featured_item_rate < 0 ||
      stateSettings.featured_item_rate > 100
    ) {
      return reportValidationIssue(
        {
          message: t("The featured-item rate must be between 0% and 100%."),
          target: "luck",
        },
        t("Check gacha settings"),
      );
    }
    const invalidSchedule = stateBanners.find((banner) => {
      if (!banner.starts_at || !banner.ends_at) return false;
      return Date.parse(banner.ends_at) <= Date.parse(banner.starts_at);
    });
    if (invalidSchedule) {
      return reportValidationIssue(
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
      return reportValidationIssue(
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
        !stateEntries.some(
          (entry) => entry.banner_id === banner.id && entry.active,
        ),
    );
    if (emptyBanner) {
      return reportValidationIssue(
        {
          message: t(
            'The active banner "{{name}}" needs at least one active merch item.',
            { name: emptyBanner.name },
          ),
          target: "pool",
          bannerId: emptyBanner.id,
        },
        t("Wish pool is empty"),
      );
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
      return reportValidationIssue(
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
      const rule = getGachaBannerFeaturedRule(activeGame, banner.kind);
      const composition = getGachaFeaturedComposition(stateEntries, banner);
      if (composition.invalidCount > 0) {
        return reportValidationIssue(
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
        if (!hasGachaBannerRarities(stateEntries, banner, false)) {
          return reportValidationIssue(
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
      if (rule.requireCompleteComposition) {
        if (
          !isGachaFeaturedCompositionComplete(stateEntries, banner, activeGame)
        ) {
          return reportValidationIssue(
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
      } else if (
        composition.totalCount > 0 &&
        (composition.fiveStarCount !== rule.fiveStarLimit ||
          composition.fourStarCount > rule.fourStarLimit)
      ) {
        return reportValidationIssue(
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
        stateSettings.featured_item_rate < 100 &&
        !hasGachaBannerRarities(stateEntries, banner, false)
      ) {
        return reportValidationIssue(
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
    return true;
  }

  async function publish() {
    if (!current || !validateBasics(current) || !validateGoLive(current))
      return;
    setValidationIssue(null);
    setPublishError("");
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
      const message = t(getErrorMessage(error, "Could not save the minigame."));
      setPublishError(message);
      toast.error(message, t("Could not publish gacha"));
    });
    if (published) toast.success(t("Gacha settings published."));
  }

  function requestPublish() {
    const switchesLiveGame = GACHA_GAME_TYPES.some(
      (gameType) => gameType !== activeGame && Boolean(liveByGame[gameType]),
    );
    if (switchesLiveGame) {
      setConfirmation({ type: "publish-switch" });
      return;
    }
    void publish();
  }

  async function resetCurrentGame() {
    try {
      await runReset(async () => {
        const next = await getAdminGachaConfiguration(shopId);
        const fresh = createGameState(
          shopId,
          activeGame,
          next.configurations[activeGame],
        );
        setLiveByGame(next.liveByGame);
        setBaselines((curr) => ({ ...curr, [activeGame]: fresh }));
        resetGame(activeGame, fresh);
        setAutosaveError(null);
        setPublishError("");
        setValidationIssue(null);
      });
    } catch (error) {
      toast.error(
        t(getErrorMessage(error, "Could not load the minigame.")),
        t("Gacha unavailable"),
      );
    }
  }

  async function discardCurrentGame() {
    await resetCurrentGame();
    setConfirmation(null);
  }

  async function retryAutosave() {
    if (!autosaveError) return;
    const { gameType, snapshot, snapshotKey } = autosaveError;
    setAutosaveError(null);
    try {
      await runSave(async () => {
        const saved = await saveGachaDraft(shopId, gameType, snapshot);
        const savedState = createGameState(shopId, gameType, saved);
        setBaselines((curr) => ({ ...curr, [gameType]: savedState }));
      });
    } catch (error) {
      setAutosaveError({
        message: t(getErrorMessage(error, "Could not save draft")),
        snapshotKey,
        gameType,
        snapshot,
      });
    }
  }

  const updateSettings = useCallback(
    (changes: Partial<GachaSettings>, asTextEdit = false) => {
      setValidationIssue(null);
      setPublishError("");
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
    const banner = banners[0];
    const rule = getGachaBannerFeaturedRule(activeGame, banner.kind);
    if (availableProducts.length < rule.displayLimit) {
      toast.info(
        t(
          "Add at least {{count}} active products to fill this banner's featured lineup.",
          { count: rule.displayLimit },
        ),
        t("More merch needed"),
      );
      return;
    }
    const plan = getRecommendedGachaEntryPlan(
      availableProducts.map((product) => product.id),
      banner,
      activeGame,
      settings?.featured_item_rate ?? 50,
    );
    setValidationIssue(null);
    setPublishError("");
    update(
      (state) => ({
        ...state,
        settings: { ...state.settings, enabled: plan.canEnable },
        selectedBannerId: banner.id,
        entries: plan.entries.map(({ productId, rarity, featured }) => ({
          ...newEntry(shopId, banner.id, productId, banner.kind, activeGame),
          rarity,
          featured,
        })),
      }),
      true,
    );
    if (plan.canEnable) {
      toast.success(
        t("Recommended pool created. Review it, then publish when ready."),
      );
    } else {
      toast.info(
        t(
          "The featured lineup was created, but the minigame stays off until you add non-featured 4★ and 5★ loss candidates.",
        ),
        t("Loss candidates needed"),
      );
    }
  }

  const updateBanner = useCallback(
    (changes: Partial<GachaBanner>) => {
      setValidationIssue(null);
      setPublishError("");
      const isTextChange = "name" in changes || "description" in changes;
      const updater = (curr: GachaState): GachaState => {
        const nextBanners = curr.banners.map((banner) => {
          if (banner.id !== curr.selectedBannerId) return banner;
          const kind = changes.kind ?? banner.kind;
          return {
            ...banner,
            ...changes,
            display_limit: normalizeGachaDisplayLimit(
              changes.display_limit ?? banner.display_limit,
              activeGame,
              kind,
            ),
          };
        });
        return {
          ...curr,
          banners: nextBanners,
          entries: capGachaFeaturedEntries(
            curr.entries,
            nextBanners,
            activeGame,
          ),
        };
      };
      if (isTextChange) updateText(updater);
      else update(updater, true);
    },
    [activeGame, update, updateText],
  );

  const setSelectedBannerId = useCallback(
    (id: string) => {
      setValidationIssue(null);
      update((curr) => ({ ...curr, selectedBannerId: id }), false);
    },
    [update],
  );

  const updateDisplayLimit = useCallback(
    (displayLimit: number) => {
      setValidationIssue(null);
      setPublishError("");
      update((curr) => {
        const nextBanners = curr.banners.map((banner) => {
          if (banner.id !== curr.selectedBannerId) return banner;
          return {
            ...banner,
            display_limit: normalizeGachaDisplayLimit(
              displayLimit,
              activeGame,
              banner.kind,
            ),
          };
        });
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
      setValidationIssue(null);
      setPublishError("");
      const { defaults } = descriptor;
      const banner: GachaBanner = {
        ...(source ?? defaultGachaBanner(shopId)),
        id: crypto.randomUUID(),
        name: source ? `${source.name} copy` : `Banner ${banners.length + 1}`,
        theme: source?.theme ?? defaults.bannerTheme,
        display_limit: normalizeGachaDisplayLimit(
          source?.display_limit ?? defaults.displayLimit,
          activeGame,
          source?.kind ?? "character",
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
    setConfirmation({
      type: "delete-banner",
      bannerId: selectedBanner.id,
      bannerName: selectedBanner.name,
    });
  }, [banners.length, selectedBanner]);

  const confirmRemoveBanner = useCallback(() => {
    if (confirmation?.type !== "delete-banner") return;
    const bannerId = confirmation.bannerId;
    setValidationIssue(null);
    setPublishError("");
    update((curr) => {
      const next = curr.banners.filter((banner) => banner.id !== bannerId);
      return {
        ...curr,
        banners: next,
        entries: curr.entries.filter((entry) => entry.banner_id !== bannerId),
        selectedBannerId: next[0]?.id ?? "",
      };
    }, true);
    setConfirmation(null);
  }, [confirmation, update]);

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
      setValidationIssue(null);
      setPublishError("");
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
      setValidationIssue(null);
      setPublishError("");
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
      const rule = getGachaBannerFeaturedRule(activeGame, selectedBanner.kind);
      if (featured) {
        if (!matchesGachaBannerKind(entry, selectedBanner)) {
          toast.info(
            t("Featured items must match the banner type."),
            t("Choose a matching role"),
          );
          return;
        }
        if (entry.rarity === 3) {
          toast.info(
            t("Only 5★ and 4★ items can use featured banner slots."),
            t("Choose a featured rarity"),
          );
          return;
        }
        const sameRarityCount = activeEntries.filter(
          (candidate) =>
            candidate.featured &&
            candidate.rarity === entry.rarity &&
            matchesGachaBannerKind(candidate, selectedBanner),
        ).length;
        const rarityLimit =
          entry.rarity === 5 ? rule.fiveStarLimit : rule.fourStarLimit;
        if (sameRarityCount >= rarityLimit) {
          toast.info(
            t(
              entry.rarity === 5
                ? "This banner has filled its 5★ featured slots."
                : "This banner has filled its 4★ rate-up slots.",
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
      activeGame,
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

  const handleSwitchGame = useCallback(
    (gameType: GachaGameType) => {
      setValidationIssue(null);
      setPublishError("");
      setConfirmation(null);
      switchGame(gameType);
    },
    [switchGame],
  );

  const toggleShared3StarProduct = useCallback(
    (productId: string) => {
      if (!selectedBanner) return;
      setValidationIssue(null);
      setPublishError("");
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

  if (loading) {
    return (
      <EmptyState
        tone="loading"
        icon={<LoaderCircle className="state-spinner" size={28} />}
        title={t("Loading gacha settings…")}
        message={t("Preparing the shop’s merch banners.")}
      />
    );
  }

  if (loadError || !current || !settings || !selectedBanner) {
    return (
      <EmptyState
        tone="error"
        title={t("Gacha unavailable")}
        message={loadError || t("Could not load the minigame.")}
        action={
          <Button
            variant="secondary"
            icon={<RefreshCw size={17} />}
            onClick={() => setReloadNonce((value) => value + 1)}
          >
            {t("Retry loading")}
          </Button>
        }
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
        onSwitchGame={handleSwitchGame}
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
      <div id="gacha-validation-general" className="gacha-section-anchor">
        <GachaGeneralSection
          settings={settings}
          titleError={
            validationIssue?.target === "general" ? validationIssue.message : ""
          }
          onUpdateSettings={updateSettings}
          onTextFocus={beginTextSession}
        />
      </div>
      <div id="gacha-validation-banner" className="gacha-section-anchor">
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
            error={
              validationIssue?.target === "banner"
                ? validationIssue.message
                : ""
            }
            errorField={
              validationIssue?.target === "banner"
                ? validationIssue.field
                : undefined
            }
            onUpdateBanner={updateBanner}
            onUpdateDisplayLimit={updateDisplayLimit}
            onTextFocus={beginTextSession}
          />
          <div id="gacha-validation-pool">
            <GachaPoolEditor
              products={products}
              banner={selectedBanner}
              banners={banners}
              entries={entries}
              descriptor={descriptor}
              error={
                validationIssue?.target === "pool"
                  ? validationIssue.message
                  : ""
              }
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
          </div>
        </AdminCard>
      </div>
      <div id="gacha-validation-luck" className="gacha-section-anchor">
        <GachaLuckSection
          settings={settings}
          descriptor={descriptor}
          error={
            validationIssue?.target === "luck" ? validationIssue.message : ""
          }
          onUpdateSettings={updateSettings}
          onTextFocus={beginTextSession}
        />
      </div>
      {(autosaveError || publishError) && (
        <div className="gacha-persistent-feedback">
          {autosaveError && (
            <Alert variant="error" title={t("Could not save draft")}>
              <span>{autosaveError.message}</span>{" "}
              <button
                type="button"
                className="gacha-inline-retry"
                disabled={saving || publishing}
                onClick={() => void retryAutosave()}
              >
                {t("Retry saving")}
              </button>
            </Alert>
          )}
          {publishError && (
            <Alert variant="error" title={t("Could not publish gacha")}>
              {publishError}
            </Alert>
          )}
        </div>
      )}
      <GachaEditBar
        dirty={dirty}
        saving={saving}
        publishing={publishing}
        onReset={() => setConfirmation({ type: "discard" })}
        onPublish={requestPublish}
      />
      <ConfirmationDialog
        isOpen={confirmation?.type === "discard"}
        title={t("Discard changes?")}
        message={t("Discard all unpublished changes for this game?")}
        cancelLabel={t("Keep editing")}
        confirmLabel={t("Discard changes")}
        loadingLabel={t("Discarding…")}
        busy={resetting}
        onClose={() => setConfirmation(null)}
        onConfirm={() => void discardCurrentGame()}
      />
      <ConfirmationDialog
        isOpen={confirmation?.type === "delete-banner"}
        title={t("Delete banner?")}
        message={t(
          "Delete banner “{{name}}”? Its pool items will be removed too.",
          {
            name:
              confirmation?.type === "delete-banner"
                ? confirmation.bannerName
                : "",
          },
        )}
        cancelLabel={t("Cancel")}
        confirmLabel={t("Delete banner")}
        onClose={() => setConfirmation(null)}
        onConfirm={confirmRemoveBanner}
      />
      <ConfirmationDialog
        isOpen={confirmation?.type === "publish-switch"}
        title={t("Switch the live minigame?")}
        message={t(
          "Publishing switches the public minigame to {{game}}. Continue?",
          { game: descriptor.label },
        )}
        cancelLabel={t("Keep editing")}
        confirmLabel={t("Publish")}
        loadingLabel={t("Publishing…")}
        busy={publishing}
        danger={false}
        onClose={() => setConfirmation(null)}
        onConfirm={() => {
          setConfirmation(null);
          void publish();
        }}
      />
    </div>
  );
}
