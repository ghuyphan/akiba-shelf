import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, Check, Download, Sparkles } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { EmptyState } from "../components/ui/EmptyState";
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
} from "../lib/gachaLaunch";
import { translations } from "../lib/catalogI18n";
import { getErrorMessage } from "../lib/errors";
import { prefersLightweightCatalog } from "../lib/network";
import type { GachaLaunchData } from "../lib/gachaLaunch";
import {
  downloadGachaOfflinePack,
  downloadGachaOfflinePacks,
  hasGachaOfflinePack,
  offlinePackPercent,
} from "../lib/offlinePack";
import type { GachaCatalog, GachaGameType } from "../types/gacha";
import genshinWishBackground from "../../vendor/gacha-simulator/static/images/background/wish-background.webp";
import genshinLogo from "../../vendor/gacha-simulator/static/images/utility/genshin-logo.webp";
import genshinWishButton from "../../vendor/gacha-simulator/static/images/utility/button.webp";
import intertwinedFate from "../../vendor/gacha-simulator/static/images/utility/intertwined-fate.webp";
import hsrWarpBackground from "../../vendor/hsr-simulator/src/images/background/warp-bg.webp";
import hsrCircleOrnament from "../../vendor/hsr-simulator/src/images/utils/circle-ornament1.svg";
import hsrLogo from "../../vendor/hsr-simulator/src/images/utils/starrail-logo.webp";
import hsrSpecialPass from "../../vendor/hsr-simulator/src/images/utils/special-pass-clean.webp";
import "../styles/gacha-host.css";

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
  const offlineProgressRef = useRef({ status: "idle", progress: 0 });
  const [packDownload, setPackDownload] = useState<{
    status: "idle" | "downloading" | "ready" | "error";
    progress: number;
    game?: GachaGameType;
  }>({ status: "idle", progress: 0 });

  useEffect(() => {
    document.body.classList.add("gacha-screen");
    return () => document.body.classList.remove("gacha-screen");
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      let hasLaunch = false;
      setState(null);
      setError(null);
      const applyLaunch = (launch: GachaLaunchData) => {
        const previewCatalog = preview && selectedGame
          ? parseGachaPreviewConfig(
              localStorage.getItem(
                `${GACHA_PREVIEW_CONFIG_STORAGE_PREFIX}${launch.shop.slug}:${selectedGame}`,
              ) ?? localStorage.getItem(
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
        if (previewCatalog && selectedGame) catalogs[selectedGame] = previewCatalog;
        const available = (["genshin", "hsr"] as const).filter((gameType) => {
          const catalog = catalogs[gameType];
          return Boolean(
            catalog?.settings &&
              (catalog.settings.enabled || (preview && selectedGame === gameType)) &&
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

  const availableGames = (["genshin", "hsr"] as const).filter((gameType) => {
    const catalog = state?.catalogs[gameType];
    return Boolean(
      catalog?.settings &&
        (catalog.settings.enabled || (preview && selectedGame === gameType)) &&
        catalog.banners.length &&
        catalog.entries.length,
    );
  });
  const activeGame =
    selectedGame && availableGames.includes(selectedGame)
      ? selectedGame
      : availableGames.length === 1
        ? availableGames[0]
        : null;
  const activeCatalog: GachaCatalog | null = activeGame
    ? state?.catalogs[activeGame] ?? null
    : null;
  const activeCatalogFingerprint = activeCatalog
    ? JSON.stringify(activeCatalog)
    : "";

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
          availableGames.length > 1
            ? `/s/${shopSlug}/play`
            : `/s/${shopSlug}`,
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
          const productImages = activeCatalog.entries.flatMap((entry) => [
            ...(entry.product.images ?? []),
            ...(entry.product.image_variants ?? []).flatMap((image) => [
              image.thumbnail,
              image.detail,
            ]),
          ]);
          sendOfflineProgress("downloading", 0);
          await downloadGachaOfflinePack(gameType, productImages, (progress) => {
            sendOfflineProgress(
              "downloading",
              offlinePackPercent(progress),
            );
          });
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
  }, [activeCatalog, activeGame, availableGames.length, navigate, sendOfflineProgress, shopSlug, state]);

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
  if (!state) return <main className="gacha-host" />;

  if (availableGames.length === 0) {
    return (
      <main className="gacha-host-state">
        <EmptyState
          icon={<Sparkles size={28} />}
          title={copy.wishUnavailable}
          message={
            copy.wishPoolEmptyHint
          }
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
        (state.catalogs[gameType]?.entries ?? []).flatMap((entry) => [
          ...(entry.product.images ?? []),
          ...(entry.product.image_variants ?? []).flatMap((image) => [
            image.thumbnail,
            image.detail,
          ]),
        ]),
      ]),
    );
    setPackDownload({ status: "downloading", progress: 1 });
    try {
      await downloadGachaOfflinePacks(availableGames, imagesByGame, (progress) => {
        setPackDownload({
          status: "downloading",
          progress: progress.percent,
          game: progress.gameType,
        });
      });
      setPackDownload({ status: "ready", progress: 100 });
    } catch {
      setPackDownload({ status: "error", progress: 0 });
    }
  }

  if (!activeGame || !activeCatalog) {
    return (
      <main className="gacha-game-select">
        <div className="gacha-select-actions">
          <Link className="gacha-select-back" to={`/s/${shopSlug}`} title={copy.backToStore}>
            <ArrowLeft size={18} /> <span>{copy.backToStore}</span>
          </Link>
          <button
            type="button"
            className={`gacha-cache-btn is-${packDownload.status}`}
            disabled={packDownload.status === "downloading"}
            onClick={() => void saveAvailableGames()}
            title={
              packDownload.status === "ready"
                ? copy.gachaOfflineReady
                : packDownload.status === "downloading"
                  ? copy.savingGachaOffline
                  : copy.saveBothGachaOffline
            }
          >
            {packDownload.status === "downloading" ? (
              <span className="gacha-cache-pct">{packDownload.progress}%</span>
            ) : packDownload.status === "ready" ? (
              <Check size={18} />
            ) : (
              <Download size={18} />
            )}
            <span>
              {packDownload.status === "ready"
                ? copy.gachaOfflineReady
                : packDownload.status === "downloading"
                  ? copy.savingGachaOffline
                  : copy.saveBothGachaOffline}
            </span>
          </button>
        </div>
        <section className="gacha-select-panel">
          <div className="gacha-select-heading">
            <span>{state.shop.name}</span>
            <h1>{copy.chooseGachaTitle}</h1>
          </div>
          <div className="gacha-game-portals">
            {availableGames.map((gameType) => {
              const isHsr = gameType === "hsr";
              return (
                <Link
                  key={gameType}
                  className={`gacha-game-portal is-${gameType}`}
                  to={`?game=${gameType}`}
                  style={{
                    "--portal-background": `url(${isHsr ? hsrWarpBackground : genshinWishBackground})`,
                    "--portal-button": isHsr ? "none" : `url(${genshinWishButton})`,
                  } as CSSProperties}
                >
                  <span className="gacha-portal-art" aria-hidden="true">
                    {isHsr && <img className="gacha-hsr-ornament" src={hsrCircleOrnament} alt="" />}
                    <img
                      className="gacha-portal-currency"
                      src={isHsr ? hsrSpecialPass : intertwinedFate}
                      alt=""
                    />
                  </span>
                  <span className="gacha-portal-content">
                    <img
                      className="gacha-portal-logo"
                      src={isHsr ? hsrLogo : genshinLogo}
                      alt={isHsr ? "Honkai: Star Rail" : "Genshin Impact"}
                    />
                    <small>{isHsr ? "Warp Simulator" : "Wish Simulator"}</small>
                    <span className="gacha-portal-enter">
                      <span>{copy.enterGacha}</span>
                      <span aria-hidden="true">›</span>
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="gacha-host">
      <iframe
        key={`${activeGame}:${activeCatalogFingerprint}`}
        ref={iframeRef}
        title="wish simulator"
        src={`${getGachaSimulatorPath(activeGame)}?${queryParams.toString()}`}
        allow="fullscreen"
      />
    </main>
  );
}
