import "@fontsource-variable/outfit/wght.css";
import { Link } from "react-router";
import {
  ArrowRight,
  ClipboardCheck,
  LogIn,
  PackageCheck,
  Palette,
  ScanLine,
  ShoppingBag,
  Store,
} from "lucide-react";
import { AppHeader } from "../components/ui/AppHeader";
import { PlatformHeaderBrand } from "../components/ui/PlatformHeaderBrand";
import { PlatformLanguageToggle } from "../components/ui/PlatformLanguageToggle";
import { PLATFORM_BRAND } from "../lib/branding";
import { usePlatformI18n } from "../lib/i18n/platformI18n";
import "../styles/admin/admin.css";

export function HomePage() {
  const { t } = usePlatformI18n();

  return (
    <div className="admin-shell platform-home-shell platform-home-landing">
      <AppHeader
        brand={<PlatformHeaderBrand subtitle={t(PLATFORM_BRAND.descriptor)} />}
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

      <main className="admin-container platform-home-container">
        <section className="platform-home-hero">
          <div className="platform-home-hero-copy">
            <span className="platform-home-kicker">
              {t("Storefront and order desk for artist booths")}
            </span>
            <h1>
              {t("Run your merch booth.")}{" "}
              <span>
                {t("Stay in sync.")}
                <span
                  className="platform-landing-title-underline"
                  aria-hidden="true"
                />
              </span>
            </h1>
            <p>
              {t(
                "Fans order on their phones. Matsuri reserves stock and keeps one live queue for your team.",
              )}
            </p>
            <div className="platform-home-hero-actions">
              <Link
                to="/auth"
                className="button button-primary platform-home-cta"
              >
                {t("Create your storefront")} <ArrowRight size={17} />
              </Link>
              <Link to="/s/demo-booth" className="button platform-home-demo">
                <Store size={17} /> {t("See the demo booth")}
              </Link>
            </div>
          </div>

          <figure className="platform-home-hero-preview">
            <span className="platform-home-preview-tape" aria-hidden="true" />
            <div className="platform-home-preview-desktop">
              <img
                src="/landing/demo-storefront-desktop.jpg"
                alt={t(
                  "Matsuri demo storefront with product collections and booth information",
                )}
                width="1280"
                height="900"
                fetchPriority="high"
              />
            </div>
            <div className="platform-home-preview-phone">
              <img
                src="/landing/demo-storefront-mobile.jpg"
                alt={t("Matsuri demo storefront shown on a phone")}
                width="430"
                height="900"
              />
            </div>
          </figure>
        </section>

        <section
          className="platform-home-benefits"
          aria-label={t("Who Matsuri helps")}
        >
          <article>
            <b>{t("Scan to shop")}</b>
            <span>{t("A quick storefront on every phone")}</span>
          </article>
          <article>
            <b>{t("Stock stays honest")}</b>
            <span>{t("Items are reserved when an order is placed")}</span>
          </article>
          <article>
            <b>{t("One live queue")}</b>
            <span>{t("Everyone sees what needs packing next")}</span>
          </article>
          <article>
            <b>{t("Still your booth")}</b>
            <span>{t("Use your colors, artwork, and sections")}</span>
          </article>
        </section>

        <section className="platform-home-flow" id="how">
          <header>
            <h2>{t("From QR scan to handover, without the paper trail.")}</h2>
            <p>
              {t(
                "A short customer flow in front, with the order detail your team needs behind the table.",
              )}
            </p>
          </header>
          <div className="platform-home-flow-list">
            <article>
              <span>
                <ScanLine size={25} strokeWidth={1.8} />
              </span>
              <div>
                <h3>{t("Fans scan and browse")}</h3>
                <p>
                  {t(
                    "Your storefront opens on their phone with your collections, product details, and booth identity.",
                  )}
                </p>
              </div>
            </article>
            <article>
              <span>
                <ShoppingBag size={25} strokeWidth={1.8} />
              </span>
              <div>
                <h3>{t("Stock is reserved")}</h3>
                <p>
                  {t(
                    "Matsuri checks the current price and availability, reserves the items, and shows the order total with VietQR.",
                  )}
                </p>
              </div>
            </article>
            <article>
              <span>
                <ClipboardCheck size={25} strokeWidth={1.8} />
              </span>
              <div>
                <h3>{t("Your team fulfils it")}</h3>
                <p>
                  {t(
                    "The order appears in one live queue, ready to verify, pack, and hand to the right customer.",
                  )}
                </p>
              </div>
            </article>
          </div>
        </section>

        <section className="platform-home-toolkit" id="tools">
          <div className="platform-home-toolkit-copy">
            <span>{t("Two sides, one booth")}</span>
            <h2>
              {t("A storefront for fans. A clear order desk for your team.")}
            </h2>
            <p>
              {t(
                "Shape the public booth around your art, then run orders from a focused workspace that keeps payment, stock, and fulfilment status together.",
              )}
            </p>
            <ul>
              <li>
                {t("Design the storefront with your own visual identity")}
              </li>
              <li>
                {t("Keep the current order status visible to the whole team")}
              </li>
              <li>{t("Protect stock from being sold twice during a rush")}</li>
            </ul>
          </div>
          <aside
            className="platform-home-pinboard"
            aria-label={t("Matsuri workspace preview")}
          >
            <article className="platform-home-pinboard-orders">
              <span>
                <ClipboardCheck size={15} strokeWidth={1.8} />
                {t("Live orders")}
              </span>
              <strong>
                {t("See pending, paid, and completed orders in one place")}
              </strong>
            </article>
            <article className="platform-home-pinboard-stock">
              <span>
                <PackageCheck size={15} strokeWidth={1.8} />
                {t("Inventory")}
              </span>
              <strong>{t("Reserved as orders arrive")}</strong>
            </article>
            <article className="platform-home-pinboard-design">
              <span>
                <Palette size={15} strokeWidth={1.8} />
                {t("Storefront design")}
              </span>
              <strong>
                {t("Use your own colors, logo, and visual style")}
              </strong>
            </article>
          </aside>
        </section>

        <section className="platform-home-surfaces" id="demo">
          <header>
            <span>{t("From fan to fulfilment")}</span>
            <h2>{t("One artist booth, three working surfaces.")}</h2>
            <p>
              {t(
                "A public catalog, a packing desk, and an optional event game—connected by the same products and stock.",
              )}
            </p>
          </header>
          <div className="platform-home-demo-table">
            <Link
              to="/auth?mode=signin"
              className="platform-home-demo-piece platform-home-demo-admin"
            >
              <div className="platform-home-demo-heading">
                <span>01 · {t("Packing desk")}</span>
                <h3>{t("Orders ready to hand over")}</h3>
              </div>
              <div className="platform-home-demo-media">
                <img
                  src="/landing/demo-admin.png"
                  alt={t("Matsuri admin order queue with fulfilment details")}
                  width="1280"
                  height="640"
                  loading="lazy"
                />
              </div>
              <footer>
                <p>{t("Track stock, payment, and fulfilment without losing the booth rush.")}</p>
                <b>
                  {t("Open admin")} <ArrowRight size={15} />
                </b>
              </footer>
            </Link>

            <Link
              to="/s/demo-booth"
              className="platform-home-demo-piece platform-home-demo-store"
            >
              <span className="platform-home-demo-tape" aria-hidden="true" />
              <div className="platform-home-demo-heading">
                <span>02 · {t("Digital catalog")}</span>
                <h3>{t("Your art stays in front")}</h3>
              </div>
              <div className="platform-home-demo-media">
                <img
                  src="/landing/demo-storefront-desktop.jpg"
                  alt={t(
                    "Matsuri demo storefront with product collections and booth information",
                  )}
                  width="1280"
                  height="900"
                  loading="lazy"
                />
              </div>
              <footer>
                <b>
                  {t("See the demo booth")} <ArrowRight size={15} />
                </b>
              </footer>
            </Link>

            <Link
              to="/s/demo-booth/play"
              className="platform-home-demo-piece platform-home-demo-gacha"
            >
              <div className="platform-home-demo-heading">
                <span>03 · {t("Event extra")}</span>
                <h3>{t("A playful reason to stop by")}</h3>
              </div>
              <div className="platform-home-demo-media">
                <img
                  src="/landing/demo-gacha.jpg"
                  alt={t(
                    "Matsuri gacha selector for Genshin and Honkai Star Rail",
                  )}
                  width="1280"
                  height="720"
                  loading="lazy"
                />
              </div>
              <footer>
                <b>
                  {t("Play the demo gacha")} <ArrowRight size={15} />
                </b>
              </footer>
            </Link>
          </div>
        </section>

        <section className="platform-home-final">
          <h2>{t("Give your booth one place to sell and stay organized.")}</h2>
          <Link to="/auth" className="button button-primary platform-home-cta">
            {t("Create your storefront")} <ArrowRight size={17} />
          </Link>
        </section>
      </main>

      <footer className="platform-home-footer">
        <strong>{PLATFORM_BRAND.name}</strong>
        <span>
          {t("Made for independent artists, conventions, and pop-up booths.")}
        </span>
        <small>
          &copy; {new Date().getFullYear()} {PLATFORM_BRAND.name}
        </small>
      </footer>
    </div>
  );
}
