import { ArrowRight, LogIn, RotateCw } from "lucide-react";
import { Link } from "react-router";
import { AppHeader } from "../components/ui/AppHeader";
import { PlatformHeaderBrand } from "../components/ui/PlatformHeaderBrand";
import { PlatformStatusArt } from "../components/ui/PlatformStatusArt";
import { useCatalogCopy } from "../lib/i18n/catalogLocale";
import "../styles/admin/admin.css";

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
  const titleId = "storefront-unavailable-title";

  return (
    <div className="admin-shell platform-home-shell platform-not-found-shell platform-404-shell">
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

      <main className="admin-container platform-home-container platform-404-main">
        <section
          className="platform-404-layout"
          aria-labelledby={titleId}
          role={hasLoadError ? "alert" : undefined}
        >
          <PlatformStatusArt variant={hasLoadError ? "offline" : "missing"} />
          <div className="platform-404-copy">
            {!hasLoadError && (
              <span className="platform-404-kicker">
                {copy.storefrontUnavailableKicker}
              </span>
            )}
            <h1 id={titleId}>
              {hasLoadError ? (
                copy.catalogUnavailableTitle
              ) : (
                <>
                  {copy.unavailableTitle}{" "}
                  <span className="platform-404-title-accent">
                    {copy.unavailableTitleAccent}
                  </span>
                </>
              )}
            </h1>
            <p>
              {hasLoadError
                ? copy.unavailableLoadError
                : copy.unavailableNotFound}
            </p>
            <div className="platform-404-actions">
              {hasLoadError ? (
                <button
                  type="button"
                  className="button button-primary platform-home-cta"
                  onClick={onRetry}
                >
                  <RotateCw size={17} /> {copy.tryAgain}
                </button>
              ) : (
                <Link
                  to="/"
                  className="button button-primary platform-home-cta"
                >
                  {copy.backToMatsuri} <ArrowRight size={17} />
                </Link>
              )}

              {hasLoadError ? (
                <Link to="/" className="platform-404-demo-link">
                  {copy.backToMatsuri} <span aria-hidden="true">→</span>
                </Link>
              ) : (
                showDemoLink && (
                  <Link
                    to="/s/demo-booth"
                    className="platform-404-demo-link"
                  >
                    {copy.visitDemoBooth} <span aria-hidden="true">→</span>
                  </Link>
                )
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
