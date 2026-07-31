import { Home } from "lucide-react";
import { Link } from "react-router";
import { AppHeader } from "../components/ui/AppHeader";
import { PlatformHeaderBrand } from "../components/ui/PlatformHeaderBrand";
import { PlatformLanguageToggle } from "../components/ui/PlatformLanguageToggle";
import { PlatformStatusArt } from "../components/ui/PlatformStatusArt";
import { PLATFORM_BRAND } from "../lib/branding";
import { usePlatformI18n } from "../lib/i18n/platformI18n";
import "../styles/admin/admin.css";

export function NotFoundPage() {
  const { t } = usePlatformI18n();

  return (
    <div className="admin-shell platform-home-shell platform-not-found-shell platform-404-shell">
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
        actions={<PlatformLanguageToggle />}
      />

      <main className="admin-container platform-home-container platform-404-main">
        <section
          className="platform-404-layout"
          aria-labelledby="platform-404-title"
        >
          <PlatformStatusArt variant="missing" />
          <div className="platform-404-copy">
            <span className="platform-404-kicker">
              <span>404 · {t("Booth aisle not found")}</span>
            </span>
            <h1 id="platform-404-title">{t("This page wandered off.")}</h1>
            <p>
              {t(
                "There is nothing at this address. The link may be old, mistyped, or moved to another part of Matsuri.",
              )}
            </p>
            <div className="platform-404-actions">
              <Link to="/" className="button button-primary platform-home-cta">
                <Home size={17} /> {t("Back to Matsuri")}
              </Link>
              <Link to="/s/demo-booth" className="platform-404-demo-link">
                {t("Visit the demo booth")} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
