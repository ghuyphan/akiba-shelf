import { Link } from "react-router-dom";
import { ArrowRight, LogIn, Store, Sparkles } from "lucide-react";
import { PLATFORM_BRAND } from "../lib/branding";
import { PlatformMark } from "../components/ui/PlatformMark";
import { LocaleSwitcher } from "../components/ui/LocaleSwitcher";
import { useI18n } from "../lib/i18n";
import "../styles/admin.css";

export function HomePage() {
  const { copy } = useI18n();
  return (
    <div className="admin-shell platform-home-shell">
      <header className="admin-header">
        <div className="admin-header-pill">
          <div className="admin-header-brand">
            <span className="admin-header-mark">
              <PlatformMark />
            </span>
            <div>
              <strong>{PLATFORM_BRAND.name}</strong>
              <small>{copy.brand.descriptor}</small>
            </div>
          </div>
          <div />
          <div className="admin-header-actions">
            <LocaleSwitcher />
            <Link to="/auth?mode=signin" className="button button-ghost platform-home-signin-btn">
              <LogIn size={16} />
              <span>{copy.common.signIn}</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="admin-container platform-home-container">
        <div className="platform-home-hero-content">
          <span className="platform-home-badge">
            <Sparkles size={12} className="badge-icon" />
            <span>{copy.home.badge}</span>
          </span>
          <h1>{copy.home.title}</h1>
          <p>
            {copy.brand.description} {copy.brand.tagline}
          </p>

          <div className="platform-home-actions">
            <Link to="/auth" className="button button-primary platform-home-cta">
              <span>{copy.home.getStarted}</span>
              <ArrowRight size={17} />
            </Link>
            <Link to="/s/arigatosan" className="button button-secondary platform-home-demo">
              <Store size={17} />
              <span>{copy.home.demo}</span>
            </Link>
          </div>
        </div>

        <section className="platform-home-features">
          <div className="platform-feature-card">
            <h3>{copy.home.storefrontTitle}</h3><p>{copy.home.storefrontBody}</p>
          </div>
          <div className="platform-feature-card">
            <h3>{copy.home.ordersTitle}</h3><p>{copy.home.ordersBody}</p>
          </div>
          <div className="platform-feature-card">
            <h3>{copy.home.designerTitle}</h3><p>{copy.home.designerBody}</p>
          </div>
        </section>
      </main>

      <footer className="platform-home-footer">
        <p>&copy; {new Date().getFullYear()} {PLATFORM_BRAND.name}. {copy.home.rights}</p>
      </footer>
    </div>
  );
}
