import { useEffect, useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { EmptyState } from "../components/ui/EmptyState";
import {
  getGachaCatalog,
  getPublicBoothSettings,
  getPublicShop,
} from "../lib/api";
import { translations } from "../lib/catalogI18n";
import { getErrorMessage } from "../lib/errors";
import type { GachaCatalog } from "../types/gacha";
import type { BoothSettings, Shop } from "../types/catalog";
import "../styles/gacha-host.css";

type LoadState = {
  shop: Shop;
  booth: BoothSettings;
  catalog: GachaCatalog;
};

type NetworkConnection = { effectiveType?: string; saveData?: boolean };

function prefersLightweightCatalog() {
  const connection = (
    navigator as Navigator & { connection?: NetworkConnection }
  ).connection;
  return Boolean(
    connection?.saveData ||
      connection?.effectiveType === "slow-2g" ||
      connection?.effectiveType === "2g",
  );
}

export function GachaPage() {
  const { shopSlug = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preview = searchParams.get("preview") === "1";
  const [state, setState] = useState<LoadState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightweightMode] = useState(prefersLightweightCatalog);

  useEffect(() => {
    document.body.classList.add("gacha-screen");
    return () => document.body.classList.remove("gacha-screen");
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        localStorage.removeItem(`matsuri-gacha-config:${shopSlug}`);
        const shop = await getPublicShop(shopSlug);
        if (!shop) throw new Error("Shop not found.");
        const sourceShopId = shop.catalog_source_shop_id ?? shop.id;
        const [catalog, booth] = await Promise.all([
          getGachaCatalog(sourceShopId),
          getPublicBoothSettings(sourceShopId),
        ]);
        if (!active) return;
        const previewCatalog = preview
          ? localStorage.getItem(`matsuri-gacha-preview-config:${shop.slug}`)
          : null;
        const simulatorCatalog = previewCatalog
          ? (JSON.parse(previewCatalog) as GachaCatalog)
          : catalog;
        localStorage.setItem(
          `matsuri-gacha-config:${shop.slug}`,
          JSON.stringify(simulatorCatalog),
        );
        setState({ shop, booth, catalog: simulatorCatalog });
      } catch (cause) {
        if (active) setError(getErrorMessage(cause, "Could not load minigame."));
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [preview, shopSlug]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (
        event.origin === window.location.origin &&
        event.data?.type === "matsuri-gacha-close"
      ) {
        navigate(`/s/${shopSlug}`);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [navigate, shopSlug]);

  if (error) {
    return (
      <main className="gacha-host-state">
        <EmptyState
          icon={<Sparkles size={28} />}
          title="Couldn’t open the wish simulator"
          message={error}
          action={
            <Link className="button button-primary" to={`/s/${shopSlug}`}>
              <ArrowLeft size={17} /> Back to store
            </Link>
          }
        />
      </main>
    );
  }

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
      <main className="gacha-host-state">
        <EmptyState
          icon={<Sparkles size={28} />}
          title="Couldn’t open the wish simulator"
          message={error}
          action={
            <Link className="button button-primary" to={`/s/${shopSlug}`}>
              <ArrowLeft size={17} /> Back to store
            </Link>
          }
        />
      </main>
    );
  }

  if (
    state &&
    (!state.catalog.settings?.enabled ||
      state.catalog.banners.length === 0 ||
      state.catalog.entries.length === 0)
  ) {
    const copy = translations[state.booth.catalog_locale ?? "en"];
    return (
      <main className="gacha-host-state">
        <EmptyState
          icon={<Sparkles size={28} />}
          title={copy.wishUnavailable}
          message={
            state.catalog.banners.length === 0 ||
            state.catalog.entries.length === 0
              ? copy.wishPoolEmptyHint
              : copy.wishUnavailableHint
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

  return (
    <main className="gacha-host">
      <iframe
        title="wish simulator"
        src={`${import.meta.env.BASE_URL}gacha-simulator/?${queryParams.toString()}`}
        allow="fullscreen"
      />
    </main>
  );
}
