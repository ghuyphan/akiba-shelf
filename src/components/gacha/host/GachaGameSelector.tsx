import { ArrowLeft, ArrowRight, Check, Download } from "lucide-react";
import { Link } from "react-router-dom";
import type { CSSProperties, MouseEvent } from "react";
import type { CatalogCopy } from "../../../lib/i18n/catalogI18n";
import type { GachaLaunchData } from "../../../lib/gacha/gachaLaunch";
import type { GachaGameType } from "../../../types/gacha";
import genshinWishBackground from "../../../../vendor/gacha-simulator/static/images/background/wish-background.webp";
import genshinLogo from "../../../../vendor/gacha-simulator/static/images/utility/genshin-logo.webp";
import genshinWishButton from "../../../../vendor/gacha-simulator/static/images/utility/button.webp";
import intertwinedFate from "../../../../vendor/gacha-simulator/static/images/utility/intertwined-fate.webp";
import hsrWarpBackground from "../../../../vendor/hsr-simulator/src/images/background/warp-bg.webp";
import hsrCircleOrnament from "../../../../vendor/hsr-simulator/src/images/utils/circle-ornament1.svg";
import hsrLogo from "../../../../vendor/hsr-simulator/src/images/utils/starrail-logo.webp";
import hsrSpecialPass from "../../../../vendor/hsr-simulator/src/images/utils/special-pass-clean.webp";

type GachaSelectorCopy = Pick<
  CatalogCopy,
  | "backToStore"
  | "saveBothGachaOfflineHint"
  | "savingGachaOffline"
  | "gachaOfflineReady"
  | "saveBothGachaOffline"
  | "chooseGachaEyebrow"
  | "chooseGachaTitle"
  | "chooseGachaHint"
  | "warpSimulator"
  | "wishSimulator"
  | "enterGacha"
  | "gachaBannerCount"
  | "gachaPrizeCount"
  | "enterWarp"
  | "enterWish"
>;

export type GachaPackDownloadState = {
  status: "idle" | "downloading" | "ready" | "error";
  progress: number;
  game?: GachaGameType;
};

type GachaGameSelectorProps = {
  shopSlug: string;
  shopName: string;
  availableGames: GachaGameType[];
  catalogs: GachaLaunchData["catalogs"];
  copy: GachaSelectorCopy;
  launchingGame: GachaGameType | null;
  packDownload: GachaPackDownloadState;
  skipIntro: boolean;
  onSaveOffline: () => void;
  onLaunch: (
    event: MouseEvent<HTMLAnchorElement>,
    gameType: GachaGameType,
  ) => void;
};

export function GachaGameSelector({
  shopSlug,
  shopName,
  availableGames,
  catalogs,
  copy,
  launchingGame,
  packDownload,
  skipIntro,
  onSaveOffline,
  onLaunch,
}: GachaGameSelectorProps) {
  return (
    <main
      className={`gacha-game-select${skipIntro ? " skip-selector-intro" : ""}${launchingGame ? ` is-launching is-launching-${launchingGame}` : ""}`}
      aria-busy={launchingGame !== null}
    >
      <div className="gacha-select-actions">
        <Link
          className="gacha-select-back"
          to={`/s/${shopSlug}`}
          title={copy.backToStore}
          aria-label={copy.backToStore}
        >
          <ArrowLeft size={18} />
          <span>{copy.backToStore}</span>
        </Link>
        <button
          type="button"
          className={`gacha-cache-btn is-${packDownload.status}`}
          disabled={
            packDownload.status === "downloading" ||
            packDownload.status === "ready"
          }
          onClick={onSaveOffline}
          title={copy.saveBothGachaOfflineHint}
        >
          {packDownload.status === "downloading" ? (
            <span className="gacha-progress-container" aria-hidden="true">
              <svg className="gacha-progress-svg" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  className="gacha-progress-track"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  className="gacha-progress-bar"
                  strokeDasharray="100.53"
                  strokeDashoffset={
                    100.53 - (packDownload.progress / 100) * 100.53
                  }
                  transform="rotate(-90 18 18)"
                />
              </svg>
              <span className="gacha-progress-text">
                {packDownload.progress}
              </span>
            </span>
          ) : packDownload.status === "ready" ? (
            <Check size={18} />
          ) : (
            <Download size={18} />
          )}
          <span>
            {packDownload.status === "downloading"
              ? copy.savingGachaOffline
              : packDownload.status === "ready"
                ? copy.gachaOfflineReady
                : copy.saveBothGachaOffline}
          </span>
        </button>
      </div>
      <section className="gacha-select-panel">
        <div className="gacha-select-heading">
          <span>{copy.chooseGachaEyebrow}</span>
          <h1>{copy.chooseGachaTitle}</h1>
          <p>{copy.chooseGachaHint}</p>
          <strong>{shopName}</strong>
        </div>
        <div className="gacha-game-portals">
          {availableGames.map((gameType) => {
            const isHsr = gameType === "hsr";
            const catalog = catalogs[gameType];
            const uniqueProducts = Array.from(
              new Map(
                (catalog?.entries ?? []).map((entry) => [
                  entry.product.id,
                  entry.product,
                ]),
              ).values(),
            );
            const previewProducts = uniqueProducts
              .filter(
                (product) =>
                  product.images[0] ||
                  product.image_variants?.[0]?.thumbnail,
              )
              .slice(0, 4);
            const simulatorName = isHsr
              ? copy.warpSimulator
              : copy.wishSimulator;
            return (
              <Link
                key={gameType}
                className={`gacha-game-portal is-${gameType}`}
                to={`?game=${gameType}`}
                aria-label={`${copy.enterGacha}: ${simulatorName}`}
                onClick={(event) => onLaunch(event, gameType)}
                style={
                  {
                    "--portal-background": `url(${isHsr ? hsrWarpBackground : genshinWishBackground})`,
                    "--portal-button": isHsr
                      ? "none"
                      : `url(${genshinWishButton})`,
                  } as CSSProperties
                }
              >
                <span className="gacha-portal-glow" aria-hidden="true" />
                <span className="gacha-portal-art" aria-hidden="true">
                  {isHsr && (
                    <img
                      className="gacha-hsr-ornament"
                      src={hsrCircleOrnament}
                      alt=""
                    />
                  )}
                  <img
                    className="gacha-portal-currency"
                    src={isHsr ? hsrSpecialPass : intertwinedFate}
                    alt=""
                  />
                </span>
                <span className="gacha-portal-content">
                  <span className="gacha-portal-kicker">{simulatorName}</span>
                  <img
                    className="gacha-portal-logo"
                    src={isHsr ? hsrLogo : genshinLogo}
                    alt={isHsr ? "Honkai: Star Rail" : "Genshin Impact"}
                  />
                  <span className="gacha-portal-meta">
                    <span>
                      {copy.gachaBannerCount(catalog?.banners.length ?? 0)}
                    </span>
                    <span aria-hidden="true">/</span>
                    <span>{copy.gachaPrizeCount(uniqueProducts.length)}</span>
                  </span>
                  {previewProducts.length > 0 && (
                    <span className="gacha-portal-prizes" aria-hidden="true">
                      {previewProducts.map((product) => (
                        <img
                          key={product.id}
                          src={
                            product.image_variants?.[0]?.thumbnail ||
                            product.images[0]
                          }
                          alt=""
                        />
                      ))}
                      {uniqueProducts.length > previewProducts.length && (
                        <span>
                          +{uniqueProducts.length - previewProducts.length}
                        </span>
                      )}
                    </span>
                  )}
                  <span className="gacha-portal-enter">
                    <span>{isHsr ? copy.enterWarp : copy.enterWish}</span>
                    <ArrowRight size={18} aria-hidden="true" />
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
