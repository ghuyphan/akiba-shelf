import { ArrowRight, LogIn, RotateCw, Store } from "lucide-react";
import { Link } from "react-router-dom";
import { AppHeader } from "../components/ui/AppHeader";
import { PlatformMark } from "../components/ui/PlatformMark";
import { PLATFORM_BRAND } from "../lib/branding";
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
  return (
    <div className="admin-shell platform-home-shell platform-not-found-shell">
      <AppHeader
        brand={
          <Link className="platform-not-found-brand" to="/" aria-label={`${PLATFORM_BRAND.name} home`}>
            <span className="admin-header-mark">
              <PlatformMark />
            </span>
            <span className="admin-header-title">
              <strong>{PLATFORM_BRAND.name}</strong>
              <small>{PLATFORM_BRAND.descriptor}</small>
            </span>
          </Link>
        }
        actions={
          <Link to="/admin" className="admin-header-button platform-home-signin-btn">
            <LogIn size={16} />
            <span>Staff sign in</span>
          </Link>
        }
      />

      <main className="admin-container platform-home-container">
        <section className="platform-landing-hero platform-not-found-hero" role={hasLoadError ? "alert" : undefined}>
          <div className="platform-landing-hero-copy">
            <span className="platform-landing-kicker">
              <span aria-hidden="true">✦</span> 404 · Storefront unavailable
            </span>
            <h1>
              This booth <span className="platform-landing-title-accent">isn’t on the shelf.</span>
              <i className="platform-landing-title-underline" aria-hidden="true" />
            </h1>
            <p>
              {hasLoadError
                ? "We couldn’t reach it just now. Check your connection and try once more."
                : "It may have moved, closed for the day, or the link might be out of date."}
            </p>
            <div className="platform-landing-actions">
              <Link to="/" className="button button-primary platform-home-cta">
                Back to Matsuri <ArrowRight size={17} />
              </Link>
              <button type="button" className="button platform-home-demo" onClick={onRetry}>
                <RotateCw size={17} /> Try again
              </button>
            </div>
            {showDemoLink && (
              <small className="platform-landing-note">
                Looking for an example? <Link to="/s/demo-booth"><strong>Visit the demo booth.</strong></Link>
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
                  <strong>Lost booth notice</strong>
                  <small>Artist Alley · Aisle 404</small>
                </span>
                <b>not here!</b>
              </div>
              <div className="platform-landing-mini-shop">
                <div className="platform-landing-poster platform-not-found-poster">
                  <small>Storefront missing</small>
                  <strong>nothing on this shelf</strong>
                </div>
                <div className="platform-landing-product-stack">
                  <article>
                    <div className="pink">EMPTY DISPLAY</div>
                    <footer><b>Try another aisle</b><span>→</span></footer>
                  </article>
                  <article>
                    <div className="mint">404 BOOTH</div>
                    <footer><b>Link not found</b><span>♡</span></footer>
                  </article>
                </div>
              </div>
            </div>
            <div className="platform-landing-phone platform-not-found-phone">
              <div className="platform-landing-phone-notch" />
              <div className="platform-landing-phone-head"><span>Booth directory</span><span>♡</span></div>
              <div className="platform-not-found-phone-empty">
                <Store size={34} />
                <strong>No booth found</strong>
                <small>Try another link</small>
              </div>
            </div>
            <span className="platform-landing-sticker star">404</span>
            <span className="platform-landing-sticker heart">♡</span>
            <span className="platform-landing-sticker pencil">KEEP LOOKING</span>
          </div>
        </section>
      </main>

      <footer className="platform-home-footer">
        <strong>{PLATFORM_BRAND.name}</strong>
        <span>Made for independent artists, conventions, and pop-up booths.</span>
        <small>&copy; {new Date().getFullYear()} {PLATFORM_BRAND.name}</small>
      </footer>
    </div>
  );
}
