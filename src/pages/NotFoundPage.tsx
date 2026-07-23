import { Home, LogIn, MapPinOff, Store } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { AppHeader } from "../components/ui/AppHeader";
import { PlatformHeaderBrand } from "../components/ui/PlatformHeaderBrand";
import { PlatformLanguageToggle } from "../components/ui/PlatformLanguageToggle";
import { PLATFORM_BRAND } from "../lib/branding";
import { usePlatformI18n } from "../lib/i18n/platformI18n";
import "../styles/admin/admin.css";

export function NotFoundPage() {
  const { pathname } = useLocation();
  const { t } = usePlatformI18n();

  return (
    <div className="admin-shell platform-home-shell platform-not-found-shell">
      <AppHeader
        brand={
          <Link
            className="platform-not-found-brand"
            to="/"
            aria-label={t("Matsuri home")}
          >
            <PlatformHeaderBrand subtitle={t(PLATFORM_BRAND.descriptor)} />
          </Link>
        }
        actions={
          <>
            <PlatformLanguageToggle />
            <Link
              to="/auth?mode=signin"
              className="app-header-button platform-home-signin-btn"
            >
              <LogIn size={16} />
              <span>{t("Sign in")}</span>
            </Link>
          </>
        }
      />

      <main className="admin-container platform-home-container platform-404-main">
        <section className="platform-404-layout">
          <div className="platform-404-ticket" aria-hidden="true">
            <span className="platform-404-ticket-tape" />
            <header>
              <strong>MATSURI</strong>
              <small>{t("Lost & found")}</small>
            </header>
            <div className="platform-404-ticket-number">404</div>
            <div className="platform-404-ticket-label">
              <MapPinOff size={18} />
              <span>
                <small>{t("Status")}</small>
                <strong>{t("Aisle not found")}</strong>
              </span>
            </div>
            <div className="platform-404-ticket-barcode" />
            <footer>
              <span>{t("No booth assigned")}</span>
              <b>VOID</b>
            </footer>
          </div>

          <div className="platform-404-copy">
            <span className="platform-404-kicker">
              <MapPinOff size={15} /> {t("Page 404")}
            </span>
            <h1>
              {t("Wrong aisle.")}{" "}
              <span>{t("There’s no booth here.")}</span>
            </h1>
            <p>
              {t(
                "This address does not lead anywhere in Matsuri. Head home or open the demo storefront instead.",
              )}
            </p>
            <div className="platform-404-actions">
              <Link to="/" className="button button-primary platform-home-cta">
                <Home size={17} /> {t("Go home")}
              </Link>
              <Link to="/s/demo-booth" className="button platform-home-demo">
                <Store size={17} /> {t("Open demo storefront")}
              </Link>
            </div>
            <small className="platform-404-path">
              {t("You tried")} <strong>{pathname}</strong>
            </small>
          </div>
        </section>
      </main>

      <footer className="platform-home-footer">
        <strong>{PLATFORM_BRAND.name}</strong>
        <span>{t("Artist storefronts and live booth orders.")}</span>
        <small>
          &copy; {new Date().getFullYear()} {PLATFORM_BRAND.name}
        </small>
      </footer>
    </div>
  );
}
