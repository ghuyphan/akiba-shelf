import { Link } from "react-router-dom";
import { ArrowRight, LogIn, ShoppingBag, Store, Sparkles } from "lucide-react";
import "../styles/admin.css";

export function HomePage() {
  return (
    <div className="admin-shell platform-home-shell">
      <header className="admin-header">
        <div className="admin-header-pill">
          <div className="admin-header-brand">
            <span className="admin-header-mark">
              <ShoppingBag size={18} />
            </span>
            <div>
              <strong>Akiba Shelf</strong>
              <small>Artist booth platform</small>
            </div>
          </div>
          <div className="admin-header-actions">
            <Link to="/dashboard" className="button button-ghost platform-home-signin-btn">
              <LogIn size={16} />
              <span>Sign in</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="admin-container platform-home-container">
        <div className="platform-home-hero-content">
          <span className="platform-home-badge">
            <Sparkles size={12} className="badge-icon" />
            <span>Now with Multi-Shop Support</span>
          </span>
          <h1>Create your dream merch booth</h1>
          <p>
            Akiba Shelf is a touch-friendly catalog, cart, and live order management
            system designed specifically for independent artists, dealers, and fan conventions.
          </p>

          <div className="platform-home-actions">
            <Link to="/dashboard" className="button button-primary platform-home-cta">
              <span>Get started</span>
              <ArrowRight size={17} />
            </Link>
            <Link to="/s/akiba-shelf" className="button button-secondary platform-home-demo">
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
        <p>&copy; {new Date().getFullYear()} Akiba Shelf. All rights reserved.</p>
      </footer>
    </div>
  );
}
