import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { EmptyState } from "../components/ui/EmptyState";
import { PageLoading } from "../components/ui/PageLoading";
import {
  GachaGameSelector,
  type GachaPackDownloadState,
} from "../components/gacha/host/GachaGameSelector";
import {
  GACHA_CLOSE_MESSAGE_TYPE,
  GACHA_CONFIG_STORAGE_PREFIX,
  GACHA_OFFLINE_PROGRESS_MESSAGE_TYPE,
  GACHA_OFFLINE_REQUEST_MESSAGE_TYPE,
  GACHA_OFFLINE_STATUS_MESSAGE_TYPE,
  GACHA_PREVIEW_CONFIG_STORAGE_PREFIX,
  getGachaSimulatorPath,
  hasStoredGachaLaunch,
  loadGachaLaunch,
  parseGachaPreviewConfig,
  refreshGachaLaunch,
  runningGachaCatalog,
} from "../lib/gacha/gachaLaunch";
import { translations } from "../lib/i18n/catalogI18n";
import { getErrorMessage } from "../lib/errors";
import { prefersLightweightCatalog } from "../lib/network";
import type { GachaLaunchData } from "../lib/gacha/gachaLaunch";
import {
  downloadGachaOfflinePack,
  downloadGachaOfflinePacks,
  gachaCatalogOfflineUrls,
  hasGachaOfflinePack,
  offlinePackPercent,
} from "../lib/offline/offlinePack";
import type { GachaCatalog, GachaGameType } from "../types/gacha";
import "../styles/gacha/host.css";

export function GachaPage() {
  const { shopSlug = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preview = searchParams.get("preview") === "1";
  const requestedGame = searchParams.get("game");
  const selectedGame: GachaGameType | null =
    requestedGame === "genshin" || requestedGame === "hsr"
      ? requestedGame
      : null;
  const [state, setState] = useState<GachaLaunchData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightweightMode] = useState(prefersLightweightCatalog);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const offlineDownloadRef = useRef<Promise<void> | null>(null);
  const skipSelectorIntroRef = useRef(false);
  const offlineProgressRef = useRef({ status: "idle", progress: 0 });
  const [launchingGame, setLaunchingGame] = useState<GachaGameType | null>(
    null,
  );
  const [packDownload, setPackDownload] = useState<GachaPackDownloadState>({
    status: "idle",
    progress: 0,
  });

  useEffect(() => {
    document.body.classList.add("gacha-screen");
    return () => {
      document.body.classList.remove("gacha-screen");
    };
  }, []);

  useEffect(() => {
    if (!launchingGame) return;
    const launchDelay = window.matchMedia("(max-width: 760px)").matches
      ? 640
      : 1350;
    const timer = window.setTimeout(() => {
      navigate(`?game=${launchingGame}`);
    }, launchDelay);
    return () => window.clearTimeout(timer);
  }, [launchingGame, navigate]);

  useEffect(() => {
    let active = true;
    async function load() {
      let hasLaunch = false;
      setState(null);
      setError(null);
      const applyLaunch = (launch: GachaLaunchData) => {
        const previewCatalog =
          preview && selectedGame
            ? parseGachaPreviewConfig(
                localStorage.getItem(
                  `${GACHA_PREVIEW_CONFIG_STORAGE_PREFIX}${launch.shop.slug}:${selectedGame}`,
                ) ??
                  localStorage.getItem(
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
        const available = (["genshin", "hsr"] as const).filter((gameType) => {
          const catalog = catalogs[gameType];
          return Boolean(
            catalog?.settings &&
              (catalog.settings.enabled ||
                (preview && selectedGame === gameType)) &&
              catalog.banners.length &&
              catalog.entries.length,
          );
        });
        const launchGame =
          selectedGame && available.includes(selectedGame)
            ? selectedGame
            : available.length === 1
              ? available[0]
              : null;
        if (launchGame) {
          localStorage.setItem(
            `${GACHA_CONFIG_STORAGE_PREFIX}${launch.shop.slug}`,
            JSON.stringify(catalogs[launchGame]),
          );
        }
        hasLaunch = true;
        setState({ ...launch, catalogs });
      };
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
        if (active && !hasLaunch)
          setError(getErrorMessage(cause, translations.en.wishLoadError));
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [preview, selectedGame, shopSlug]);

  const availableGames = useMemo(() => {
    return (["genshin", "hsr"] as const).filter((gameType) => {
      const catalog = state?.catalogs[gameType];
      return Boolean(
        catalog?.settings &&
          (catalog.settings.enabled ||
            (preview && selectedGame === gameType)) &&
          catalog.banners.length &&
          catalog.entries.length,
      );
    });
  }, [state, preview, selectedGame]);

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
    if (!activeGame) return;
    skipSelectorIntroRef.current = true;
    setLaunchingGame(null);
  }, [activeGame]);

  useEffect(() => {
    if (!state || availableGames.length === 0) return;
    let active = true;
    async function checkOfflineStatus() {
      try {
        const checks = await Promise.all(
          availableGames.map((game) => hasGachaOfflinePack(game)),
        );
        if (!active) return;
        const allReady = checks.every(Boolean);
        if (allReady) {
          setPackDownload({ status: "ready", progress: 100 });
        }
      } catch {
        // ignore
      }
    }
    void checkOfflineStatus();
    return () => {
      active = false;
    };
  }, [state, availableGames]);

  useEffect(() => {
    if (!state || !activeCatalog) return;
    localStorage.setItem(
      `${GACHA_CONFIG_STORAGE_PREFIX}${state.shop.slug}`,
      JSON.stringify(activeCatalog),
    );
  }, [activeCatalog, state]);

  const sendOfflineProgress = useCallback(
    (
      status: "idle" | "downloading" | "ready" | "error",
      progress = 0,
      message?: string,
    ) => {
      offlineProgressRef.current = { status, progress };
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: GACHA_OFFLINE_PROGRESS_MESSAGE_TYPE,
          status,
          progress,
          message,
        },
        window.location.origin,
      );
    },
    [],
  );

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (
        event.origin !== window.location.origin ||
        event.source !== iframeRef.current?.contentWindow
      )
        return;
      if (event.data?.type === GACHA_CLOSE_MESSAGE_TYPE) {
        navigate(
          availableGames.length > 1 ? `/s/${shopSlug}/play` : `/s/${shopSlug}`,
        );
        return;
      }
      if (!activeGame || !activeCatalog) return;
      const gameType = activeGame;
      if (event.data?.type === GACHA_OFFLINE_STATUS_MESSAGE_TYPE) {
        void hasGachaOfflinePack(gameType).then((ready) => {
          if (ready) sendOfflineProgress("ready", 100);
          else
            sendOfflineProgress(
              offlineProgressRef.current.status as
                | "idle"
                | "downloading"
                | "ready"
                | "error",
              offlineProgressRef.current.progress,
            );
        });
        return;
      }
      if (
        event.data?.type !== GACHA_OFFLINE_REQUEST_MESSAGE_TYPE ||
        !state ||
        offlineDownloadRef.current
      )
        return;
      offlineDownloadRef.current = hasGachaOfflinePack(gameType)
        .then(async (ready) => {
          if (ready) {
            sendOfflineProgress("ready", 100);
            return;
          }
          const productImages = gachaCatalogOfflineUrls(activeCatalog);
          sendOfflineProgress("downloading", 0);
          await downloadGachaOfflinePack(
            gameType,
            productImages,
            (progress) => {
              sendOfflineProgress("downloading", offlinePackPercent(progress));
            },
          );
          sendOfflineProgress("ready", 100);
        })
        .catch((cause) =>
          sendOfflineProgress("error", 0, getErrorMessage(cause)),
        )
        .finally(() => {
          offlineDownloadRef.current = null;
        });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [
    activeCatalog,
    activeGame,
    availableGames.length,
    navigate,
    sendOfflineProgress,
    shopSlug,
    state,
  ]);

  const queryParams = new URLSearchParams();
  queryParams.set("shop", shopSlug);
  if (state?.booth?.catalog_locale) {
    queryParams.set("locale", state.booth.catalog_locale);
  }
  if (lightweightMode) {
    queryParams.set("lightweight", "1");
  }
  if (import.meta.env.VITE_SUPABASE_URL) {
    queryParams.set("supabase_url", import.meta.env.VITE_SUPABASE_URL);
  }
  if (import.meta.env.VITE_SUPABASE_ANON_KEY) {
    queryParams.set("supabase_anon", import.meta.env.VITE_SUPABASE_ANON_KEY);
  }

  const copy = translations[state?.booth.catalog_locale ?? "en"];

  if (error) {
    return (
      <main className="gacha-host-state">
        <EmptyState
          icon={<Sparkles size={28} />}
          title={copy.wishLoadFailed}
          message={error}
          action={
            <Link className="button button-primary" to={`/s/${shopSlug}`}>
              <ArrowLeft size={17} /> {copy.backToStore}
            </Link>
          }
        />
      </main>
    );
  }

  // Do not mount a default Genshin iframe while the catalog is unresolved.
  // HSR stores would otherwise download Genshin first and then replace it.
  if (!state) {
    return (
      <main className="gacha-host-state">
        <PageLoading />
      </main>
    );
  }

  if (availableGames.length === 0) {
    return (
      <main className="gacha-host-state">
        <EmptyState
          icon={<Sparkles size={28} />}
          title={copy.wishUnavailable}
          message={copy.wishPoolEmptyHint}
          action={
            <Link className="button button-primary" to={`/s/${shopSlug}`}>
              <ArrowLeft size={17} /> {copy.backToStore}
            </Link>
          }
        />
      </main>
    );
  }

  async function saveAvailableGames() {
    if (!state || packDownload.status === "downloading") return;
    const imagesByGame = Object.fromEntries(
      availableGames.map((gameType) => [
        gameType,
        gachaCatalogOfflineUrls(state.catalogs[gameType]),
      ]),
    );
    setPackDownload({ status: "downloading", progress: 1 });
    try {
      await downloadGachaOfflinePacks(
        availableGames,
        imagesByGame,
        (progress) => {
          setPackDownload({
            status: "downloading",
            progress: progress.percent,
            game: progress.gameType,
          });
        },
      );
      setPackDownload({ status: "ready", progress: 100 });
    } catch {
      setPackDownload({ status: "error", progress: 0 });
    }
  }

  function beginGachaLaunch(
    event: MouseEvent<HTMLAnchorElement>,
    gameType: GachaGameType,
  ) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    if (launchingGame) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      navigate(`?game=${gameType}`);
      return;
    }
    setLaunchingGame(gameType);
  }

  if (!activeGame || !activeCatalog) {
    return (
      <GachaGameSelector
        shopSlug={shopSlug}
        shopName={state.shop.name}
        availableGames={availableGames}
        catalogs={state.catalogs}
        copy={copy}
        launchingGame={launchingGame}
        packDownload={packDownload}
        skipIntro={skipSelectorIntroRef.current}
        onSaveOffline={() => void saveAvailableGames()}
        onLaunch={beginGachaLaunch}
      />
    );
  }

  return (
    <main className="gacha-host">
      <iframe
        key={activeGame}
        ref={iframeRef}
        title={activeGame === "hsr" ? copy.warpSimulator : copy.wishSimulator}
        src={`${getGachaSimulatorPath(activeGame)}?${queryParams.toString()}`}
        allow="fullscreen"
        sandbox="allow-downloads allow-same-origin allow-scripts"
        referrerPolicy="no-referrer"
      />
    </main>
  );
}
