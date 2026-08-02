import { useEffect, useMemo, useState } from "react";
import { getUserFacingErrorMessage } from "../../lib/errors";
import {
  GACHA_CONFIG_STORAGE_PREFIX,
  GACHA_PREVIEW_CONFIG_STORAGE_PREFIX,
  hasStoredGachaLaunch,
  loadGachaLaunch,
  parseGachaPreviewConfig,
  refreshGachaLaunch,
  runningGachaCatalog,
  type GachaLaunchData,
} from "../../lib/gacha/gachaLaunch";
import { translations } from "../../lib/i18n/catalogI18n";
import type { GachaCatalog, GachaGameType } from "../../types/gacha";

function readLocalStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage is optional; the network launch remains authoritative.
  }
}

function availableGachaGames(
  catalogs: GachaLaunchData["catalogs"],
  preview: boolean,
  selectedGame: GachaGameType | null,
) {
  return (["genshin", "hsr"] as const).filter((gameType) => {
    const catalog = catalogs[gameType];
    return Boolean(
      catalog?.settings &&
        (catalog.settings.enabled || (preview && selectedGame === gameType)) &&
        catalog.banners.length &&
        catalog.entries.length,
    );
  });
}

function prepareLaunchCatalogs(
  launch: GachaLaunchData,
  preview: boolean,
  selectedGame: GachaGameType | null,
) {
  const previewCatalog =
    preview && selectedGame
      ? parseGachaPreviewConfig(
          readLocalStorage(
            `${GACHA_PREVIEW_CONFIG_STORAGE_PREFIX}${launch.shop.slug}:${selectedGame}`,
          ) ??
            readLocalStorage(
              `${GACHA_PREVIEW_CONFIG_STORAGE_PREFIX}${launch.shop.slug}`,
            ),
        )
      : null;
  const catalogs = Object.fromEntries(
    Object.entries(launch.catalogs).map(([gameType, catalog]) => [
      gameType,
      runningGachaCatalog(catalog),
    ]),
  ) as GachaLaunchData["catalogs"];
  if (previewCatalog && selectedGame)
    catalogs[selectedGame] = runningGachaCatalog(previewCatalog);
  return catalogs;
}

export function useGachaLaunchState({
  shopSlug,
  preview,
  selectedGame,
}: {
  shopSlug: string;
  preview: boolean;
  selectedGame: GachaGameType | null;
}) {
  const [state, setState] = useState<GachaLaunchData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let hasLaunch = false;
    setState(null);
    setError(null);

    const applyLaunch = (launch: GachaLaunchData) => {
      const catalogs = prepareLaunchCatalogs(launch, preview, selectedGame);
      const availableGames = availableGachaGames(
        catalogs,
        preview,
        selectedGame,
      );
      const launchGame =
        selectedGame && availableGames.includes(selectedGame)
          ? selectedGame
          : availableGames.length === 1
            ? availableGames[0]
            : null;
      if (launchGame) {
        writeLocalStorage(
          `${GACHA_CONFIG_STORAGE_PREFIX}${launch.shop.slug}`,
          JSON.stringify(catalogs[launchGame]),
        );
      }
      hasLaunch = true;
      setState({ ...launch, catalogs });
    };

    async function load() {
      try {
        const hadStoredLaunch = hasStoredGachaLaunch(shopSlug);
        const launch = await loadGachaLaunch(shopSlug);
        if (!active) return;
        applyLaunch(launch);
        if (hadStoredLaunch && navigator.onLine) {
          const fresh = await refreshGachaLaunch(shopSlug);
          if (active) applyLaunch(fresh);
        }
      } catch (cause) {
        if (active && !hasLaunch) {
          setError(
            getUserFacingErrorMessage(cause, translations.en.wishLoadError),
          );
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [preview, selectedGame, shopSlug]);

  const availableGames = useMemo(
    () =>
      state
        ? availableGachaGames(state.catalogs, preview, selectedGame)
        : [],
    [preview, selectedGame, state],
  );
  const activeGame =
    selectedGame && availableGames.includes(selectedGame)
      ? selectedGame
      : availableGames.length === 1
        ? availableGames[0]
        : null;
  const activeCatalog: GachaCatalog | null = activeGame
    ? (state?.catalogs[activeGame] ?? null)
    : null;

  useEffect(() => {
    if (!state || !activeCatalog) return;
    writeLocalStorage(
      `${GACHA_CONFIG_STORAGE_PREFIX}${state.shop.slug}`,
      JSON.stringify(activeCatalog),
    );
  }, [activeCatalog, state]);

  return { state, error, availableGames, activeGame, activeCatalog };
}
