import { Link } from "react-router-dom";
import { ArrowRight, LogIn, Store, Sparkles } from "lucide-react";
import { PLATFORM_BRAND } from "../lib/branding";
import { PlatformMark } from "../components/ui/PlatformMark";
import { AppHeader } from "../components/ui/AppHeader";
import "../styles/admin.css";

export function HomePage() {
  return (
    <div className="admin-shell platform-home-shell">
      <AppHeader
        brand={
          <>
            <span className="admin-header-mark">
              <PlatformMark />
            </span>
            <span className="admin-header-title">
              <strong>{PLATFORM_BRAND.name}</strong>
              <small>{PLATFORM_BRAND.descriptor}</small>
            </span>
          </>
        }
        actions={
          <Link
            to="/auth?mode=signin"
            className="button button-ghost platform-home-signin-btn"
          >
            <LogIn size={16} />
            <span>Sign in</span>
          </Link>
        }
      />

      <main className="admin-container platform-home-container">
        <div className="platform-home-hero-content">
          <span className="platform-home-badge">
            <Sparkles size={12} className="badge-icon" />
            <span>Now with Multi-Shop Support</span>
          </span>
          <h1>Create your dream merch booth</h1>
          <p>
            {PLATFORM_BRAND.description} {PLATFORM_BRAND.tagline}
          </p>

          <div className="platform-home-actions">
            <Link to="/auth" className="button button-primary platform-home-cta">
              <span>Get started</span>
              <ArrowRight size={17} />
            </Link>
            <Link to="/s/arigatosan" className="button button-secondary platform-home-demo">
              <Store size={17} />
              <span>View demo shop</span>
            </Link>
          </div>
        </div>

        <section className="platform-home-features">
          <div className="platform-feature-card">
            <h3>Touch-friendly storefront</h3>
            <p>
              Let customers browse your products, inspect details, and build a stock-safe cart in a gorgeous mobile-first storefront.
            </p>
          </div>
          <div className="platform-feature-card">
            <h3>Live orders queue</h3>
            <p>
              Approve payments, manage stock levels, and coordinate staff fulfillment in real time as new orders arrive.
            </p>
          </div>
          <div className="platform-feature-card">
            <h3>Storefront designer</h3>
            <p>
              Customize sections, themes, locales, and corner radiuses in a live-updating interactive workspace.
            </p>
          </div>
        </section>
      </main>

      <footer className="platform-home-footer">
        <p>&copy; {new Date().getFullYear()} {PLATFORM_BRAND.name}. All rights reserved.</p>
      </footer>
    </div>
  );
}
