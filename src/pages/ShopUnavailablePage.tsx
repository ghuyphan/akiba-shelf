import { ArrowRight, LogIn, RotateCw, Store } from "lucide-react";
import { Link } from "react-router-dom";
import { AppHeader } from "../components/ui/AppHeader";
import { PlatformHeaderBrand } from "../components/ui/PlatformHeaderBrand";
import { PLATFORM_BRAND } from "../lib/branding";
import { useCatalogCopy } from "../lib/i18n/catalogI18n";
import "../styles/admin.css";

type ShopUnavailablePageProps = {
  hasLoadError: boolean;
  showDemoLink: boolean;
  onRetry: () => void;
};

export function ShopUnavailablePage({
  hasLoadError,
  showDemoLink,
  onRetry,
}: ShopUnavailablePageProps) {
  const copy = useCatalogCopy();
  return (
    <div className="admin-shell platform-home-shell platform-not-found-shell">
      <AppHeader
        brand={
          <Link
            className="platform-not-found-brand"
            to="/"
            aria-label={copy.matsuriHome}
          >
            <PlatformHeaderBrand subtitle={copy.artistBoothPlatform} />
          </Link>
        }
        actions={
          <Link
            to="/admin"
            className="app-header-button platform-home-signin-btn"
          >
            <LogIn size={16} />
            <span>{copy.staffSignIn}</span>
          </Link>
        }
      />

      <main className="admin-container platform-home-container">
        <section
          className="platform-landing-hero platform-not-found-hero"
          role={hasLoadError ? "alert" : undefined}
        >
          <div className="platform-landing-hero-copy">
            <span className="platform-landing-kicker">
              <span aria-hidden="true">✦</span> {copy.storefrontUnavailableKicker}
            </span>
            <h1>
              {copy.unavailableTitle}{" "}
              <span className="platform-landing-title-accent">
                {copy.unavailableTitleAccent}
              </span>
              <i
                className="platform-landing-title-underline"
                aria-hidden="true"
              />
            </h1>
            <p>
              {hasLoadError
                ? copy.unavailableLoadError
                : copy.unavailableNotFound}
            </p>
            <div className="platform-landing-actions">
              <Link to="/" className="button button-primary platform-home-cta">
                {copy.backToMatsuri} <ArrowRight size={17} />
              </Link>
              <button
                type="button"
                className="button platform-home-demo"
                onClick={onRetry}
              >
                <RotateCw size={17} /> {copy.tryAgain}
              </button>
            </div>
            {showDemoLink && (
              <small className="platform-landing-note">
                {copy.lookingForExample}{" "}
                <Link to="/s/demo-booth">
                  <strong>{copy.visitDemoBooth}</strong>
                </Link>
              </small>
            )}
          </div>

          <div className="platform-landing-art" aria-hidden="true">
            <div className="platform-landing-desk-shadow" />
            <span className="platform-landing-tape platform-landing-tape-one" />
            <span className="platform-landing-tape platform-landing-tape-two" />
            <div className="platform-landing-sketchbook">
              <div className="platform-landing-sketch-title">
                <span>
                  <strong>{copy.lostBoothNotice}</strong>
                  <small>{copy.artistAlley404}</small>
                </span>
                <b>{copy.notHere}</b>
              </div>
              <div className="platform-landing-mini-shop">
                <div className="platform-landing-poster platform-not-found-poster">
                  <small>{copy.storefrontMissing}</small>
                  <strong>{copy.nothingOnShelf}</strong>
                </div>
                <div className="platform-landing-product-stack">
                  <article>
                    <div className="pink">{copy.emptyDisplay}</div>
                    <footer>
                      <b>{copy.tryAnotherAisle}</b>
                      <span>→</span>
                    </footer>
                  </article>
                  <article>
                    <div className="mint">{copy.booth404}</div>
                    <footer>
                      <b>{copy.linkNotFound}</b>
                      <span>♡</span>
                    </footer>
                  </article>
                </div>
              </div>
            </div>
            <div className="platform-landing-phone platform-not-found-phone">
              <div className="platform-landing-phone-notch" />
              <div className="platform-landing-phone-head">
                <span>{copy.boothDirectory}</span>
                <span>♡</span>
              </div>
              <div className="platform-not-found-phone-empty">
                <Store size={34} />
                <strong>{copy.noBoothFound}</strong>
                <small>{copy.tryAnotherLink}</small>
              </div>
            </div>
            <span className="platform-landing-sticker star">404</span>
            <span className="platform-landing-sticker heart">♡</span>
            <span className="platform-landing-sticker pencil">
              {copy.keepLooking}
            </span>
          </div>
        </section>
      </main>

      <footer className="platform-home-footer">
        <strong>{PLATFORM_BRAND.name}</strong>
        <span>{copy.madeForArtists}</span>
        <small>
          &copy; {new Date().getFullYear()} {PLATFORM_BRAND.name}
        </small>
      </footer>
    </div>
  );
}
