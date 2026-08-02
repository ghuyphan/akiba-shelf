import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { EmptyState } from "../components/ui/EmptyState";
import { PageLoading } from "../components/ui/PageLoading";
import { CatalogUpdateNotice } from "../components/catalog/shell/CatalogAppChrome";
import { GachaGameSelector } from "../components/gacha/host/GachaGameSelector";
import {
  GACHA_CLOSE_MESSAGE_TYPE,
  getGachaSimulatorPath,
} from "../lib/gacha/gachaLaunch";
import { translations, type CatalogCopy } from "../lib/i18n/catalogI18n";
import { prefersLightweightCatalog } from "../lib/network";
import { getShopBranding, useDocumentBranding } from "../lib/branding";
import { applyDocumentSeo, resetDocumentSeo } from "../lib/seo";
import { resetPageTheme } from "../utils/theme";
import type { GachaGameType } from "../types/gacha";
import { useGachaLaunchState } from "../hooks/catalog/useGachaLaunchState";
import { useGachaOfflineBridge } from "../hooks/catalog/useGachaOfflineBridge";
import "../styles/gacha/host.css";

function GachaUpdateSurface({
  children,
  copy,
}: {
  children: ReactNode;
  copy: CatalogCopy;
}) {
  return (
    <>
      <CatalogUpdateNotice copy={copy} />
      {children}
    </>
  );
}

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
  const { state, error, availableGames, activeGame, activeCatalog } =
    useGachaLaunchState({ shopSlug, preview, selectedGame });
  const [lightweightMode] = useState(prefersLightweightCatalog);
  const skipSelectorIntroRef = useRef(false);
  const [launchingGame, setLaunchingGame] = useState<GachaGameType | null>(
    null,
  );
  const initialLanguageRef = useRef<string | null>(null);
  const catalogLocale = state?.booth.catalog_locale === "vi" ? "vi" : "en";
  const copy = translations[catalogLocale];
  const { iframeRef, packDownload, saveAvailableGames } =
    useGachaOfflineBridge({
      launch: state,
      activeGame,
      activeCatalog,
      availableGames,
      loadErrorMessage: copy.wishLoadError,
    });
  const branding = state
    ? getShopBranding(
        state.shop.name,
        state.booth.booth_name,
        state.booth.logo_url,
        state.booth.theme_background,
      )
    : null;
  useDocumentBranding(branding);

  useEffect(() => {
    initialLanguageRef.current = document.documentElement.lang || "en";
    return () => {
      document.documentElement.lang = initialLanguageRef.current || "en";
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = catalogLocale;
  }, [catalogLocale]);

  useEffect(() => {
    const shopName =
      state?.booth.booth_name.trim() || state?.shop.name.trim() || "Shop";
    applyDocumentSeo({
      description: `Play the free gacha minigame from ${shopName} on Matsuri.`,
      canonicalPath: `/s/${encodeURIComponent(shopSlug)}/play`,
      robots: "noindex, nofollow",
    });
    return () => resetDocumentSeo();
  }, [shopSlug, state?.booth.booth_name, state?.shop.name]);

  useEffect(() => {
    document.body.classList.add("gacha-screen");
    return () => {
      document.body.classList.remove("gacha-screen");
      resetPageTheme();
    };
  }, []);

  useEffect(() => {
    if (!launchingGame) return;
    const launchDelay = 640;
    const timer = window.setTimeout(() => {
      navigate(`?game=${launchingGame}`);
    }, launchDelay);
    return () => window.clearTimeout(timer);
  }, [launchingGame, navigate]);

  useEffect(() => {
    if (!activeGame) return;
    skipSelectorIntroRef.current = true;
    setLaunchingGame(null);
  }, [activeGame]);

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
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [availableGames.length, iframeRef, navigate, shopSlug]);

  const queryParams = new URLSearchParams();
  queryParams.set("shop", shopSlug);
  if (state?.booth?.catalog_locale) {
    queryParams.set("locale", state.booth.catalog_locale);
  }
  if (lightweightMode) {
    queryParams.set("lightweight", "1");
  }

  if (error) {
    return (
      <GachaUpdateSurface copy={copy}>
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
      </GachaUpdateSurface>
    );
  }

  // Do not mount a default Genshin iframe while the catalog is unresolved.
  // HSR stores would otherwise download Genshin first and then replace it.
  if (!state) {
    return (
      <GachaUpdateSurface copy={copy}>
        <main className="gacha-host-state">
          <PageLoading />
        </main>
      </GachaUpdateSurface>
    );
  }

  if (availableGames.length === 0) {
    return (
      <GachaUpdateSurface copy={copy}>
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
      </GachaUpdateSurface>
    );
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
      <GachaUpdateSurface copy={copy}>
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
      </GachaUpdateSurface>
    );
  }

  return (
    <GachaUpdateSurface copy={copy}>
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
    </GachaUpdateSurface>
  );
}
