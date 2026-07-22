import { Link } from "react-router-dom";
import {
  ArrowRight,
  ClipboardCheck,
  LogIn,
  Palette,
  PackageCheck,
  ScanLine,
  ShoppingBag,
  Store,
} from "lucide-react";
import { PLATFORM_BRAND } from "../lib/branding";
import { AppHeader } from "../components/ui/AppHeader";
import { PlatformHeaderBrand } from "../components/ui/PlatformHeaderBrand";
import { PlatformLanguageToggle } from "../components/ui/PlatformLanguageToggle";
import { usePlatformI18n } from "../lib/i18n/platformI18n";
import "../styles/admin.css";

export function HomePage() {
  const { t } = usePlatformI18n();
  return (
    <div className="admin-shell platform-home-shell">
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
        <section className="platform-landing-hero">
          <div className="platform-landing-hero-copy">
            <span className="platform-landing-kicker">
              <span aria-hidden="true">✦</span>{" "}
              {t("Storefront and order desk for artist booths")}
            </span>
            <h1>
              {t("Run your merch booth.")}{" "}
              <span className="platform-landing-title-accent">
                {t("Stay in sync.")}
              </span>
              <i
                className="platform-landing-title-underline"
                aria-hidden="true"
              />
            </h1>
            <p>
              {t(
                "Fans browse and order from their phones. Matsuri reserves the stock and gives your team one live queue to fulfil from behind the booth.",
              )}
            </p>
            <div className="platform-landing-actions">
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
            <small className="platform-landing-note">
              <strong>{t("Made for Artist Alley.")}</strong>{" "}
              {t("Your brand stays in front; the busywork stays behind it.")}
            </small>
          </div>

          <div className="platform-landing-art" aria-hidden="true">
            <div className="platform-landing-desk-shadow" />
            <span className="platform-landing-tape platform-landing-tape-one" />
            <span className="platform-landing-tape platform-landing-tape-two" />
            <div className="platform-landing-sketchbook">
              <div className="platform-landing-sketch-title">
                <span>
                  <strong>{t("Matsuri booth desk")}</strong>
                  <small>{t("Artist Alley · Table B12")}</small>
                </span>
                <b>{t("7 open orders")}</b>
              </div>
              <div className="platform-landing-mini-shop">
                <div className="platform-landing-poster">
                  <small>{t("Your storefront")}</small>
                  <strong>{t("your art takes the spotlight")}</strong>
                </div>
                <div className="platform-landing-product-stack">
                  <article>
                    <div className="pink">{t("ACRYLIC STAND")}</div>
                    <footer>
                      <b>{t("Moonlight Girl")}</b>
                      <span>120k</span>
                    </footer>
                  </article>
                  <article>
                    <div className="mint">{t("STICKER SHEET")}</div>
                    <footer>
                      <b>{t("Festival Cats")}</b>
                      <span>65k</span>
                    </footer>
                  </article>
                </div>
              </div>
            </div>
            <div className="platform-landing-phone">
              <div className="platform-landing-phone-notch" />
              <div className="platform-landing-phone-head">
                <span>{t("Order ready")}</span>
                <span>♡</span>
              </div>
              <div className="platform-landing-phone-list">
                {[
                  t("Moonlight Stand"),
                  t("Festival Cats"),
                  t("Postcard Pack"),
                ].map((name, index) => (
                  <div className="platform-landing-phone-row" key={name}>
                    <i />
                    <span>
                      <strong>{name}</strong>
                      <small>
                        {t("Qty {{count}}", { count: index === 1 ? 2 : 1 })}
                      </small>
                    </span>
                    <b>{["120k", "130k", "50k"][index]}</b>
                  </div>
                ))}
              </div>
              <div className="platform-landing-qr">
                <svg
                  viewBox="0 0 21 21"
                  role="img"
                  aria-label={t("Decorative checkout QR code")}
                  shapeRendering="crispEdges"
                >
                  <rect width="21" height="21" fill="#fff" />
                  <path
                    fill="currentColor"
                    d="M1 1h6v6H1V1Zm2 2v2h2V3H3Zm11-2h6v6h-6V1Zm2 2v2h2V3h-2ZM1 14h6v6H1v-6Zm2 2v2h2v-2H3ZM9 1h2v2H9V1Zm3 1h1v3h-2V4H9V3h3V2ZM8 6h2v2h2v1H9v2H7V9h1V6Zm4 0h1v2h-1V6Zm3 2h2v1h2v2h-1v2h-2v-2h-2V9h1V8ZM1 9h2v1h2v2H3v1H1V9Zm5 3h2v2H6v-2Zm3-2h2v2h2v2h-2v-1H9v-3Zm5 4h2v2h2v-2h2v3h-1v3h-3v-2h-2v-4Zm-5 1h2v1h2v2h-1v2H9v-2H8v-2h1v-1Z"
                  />
                </svg>
              </div>
            </div>
            <span className="platform-landing-sticker star">✦</span>
            <span className="platform-landing-sticker heart">♡</span>
            <span className="platform-landing-sticker pencil">
              {t("DRAW MORE")}
            </span>
          </div>
        </section>

        <section
          className="platform-landing-ribbon"
          aria-label={t("Who Matsuri helps")}
        >
          <span>
            <b>{t("Scan to shop")}</b>
            {t("A quick storefront on every phone")}
          </span>
          <span>
            <b>{t("Stock stays honest")}</b>
            {t("Items are reserved when an order is placed")}
          </span>
          <span>
            <b>{t("One live queue")}</b>
            {t("Everyone sees what needs packing next")}
          </span>
          <span>
            <b>{t("Still your booth")}</b>
            {t("Use your colors, artwork, and sections")}
          </span>
        </section>

        <section className="platform-landing-section" id="how">
          <div className="platform-landing-section-head">
            <small>{t("A calmer booth flow")}</small>
            <h2>{t("From QR scan to handover, without the paper trail.")}</h2>
            <p>
              {t(
                "A short customer flow in front, with the order detail your team needs behind the table.",
              )}
            </p>
          </div>
          <div className="platform-landing-zine-grid">
            <article>
              <span>01</span>
              <div>
                <ScanLine size={27} />
              </div>
              <h3>{t("Fans scan and browse")}</h3>
              <p>
                {t(
                  "Your storefront opens on their phone with your collections, product details, and booth identity.",
                )}
              </p>
            </article>
            <article>
              <span>02</span>
              <div>
                <ShoppingBag size={27} />
              </div>
              <h3>{t("Stock is reserved")}</h3>
              <p>
                {t(
                  "Matsuri checks the current price and availability, reserves the items, and shows the order total with VietQR.",
                )}
              </p>
            </article>
            <article>
              <span>03</span>
              <div>
                <ClipboardCheck size={27} />
              </div>
              <h3>{t("Your team fulfils it")}</h3>
              <p>
                {t(
                  "The order appears in one live queue, ready to verify, pack, and hand to the right customer.",
                )}
              </p>
            </article>
          </div>
        </section>

        <section
          className="platform-landing-section platform-landing-toolkit"
          id="tools"
        >
          <div className="platform-landing-toolkit-copy">
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
              <li>{t("Design the storefront with your own visual identity")}</li>
              <li>
                {t("Keep the current order status visible to the whole team")}
              </li>
              <li>{t("Protect stock from being sold twice during a rush")}</li>
            </ul>
          </div>
          <div
            className="platform-landing-pinboard"
            aria-label={t("Matsuri workspace preview")}
          >
            <article className="orders-note">
              <small>
                <ClipboardCheck size={13} /> {t("Live orders")}
              </small>
              <strong>{t("3 fans waiting")}</strong>
              <div>
                <span>
                  <b>#A104</b>
                  <i>{t("Moon Stand × 2")}</i>
                </span>
                <span>
                  <b>#A103</b>
                  <i>{t("Sticker Pack × 1")}</i>
                </span>
                <span>
                  <b>#A102</b>
                  <i>{t("Print Set × 1")}</i>
                </span>
              </div>
            </article>
            <article className="palette-note">
              <small>
                <PackageCheck size={13} /> {t("Inventory")}
              </small>
              <strong>{t("Reserved as orders arrive")}</strong>
              <div>
                <i />
                <i />
                <i />
                <i />
              </div>
            </article>
            <article className="sections-note">
              <small>
                <Palette size={13} /> {t("Storefront design")}
              </small>
              <strong>
                {t("Your colors · Your products · Your booth information")}
              </strong>
            </article>
          </div>
        </section>

        <section className="platform-landing-final">
          <div>
            <small>{t("Ready for your next event?")}</small>
            <h2>{t("Give your booth one place to sell and stay organized.")}</h2>
          </div>
          <Link to="/auth" className="button button-primary platform-home-cta">
            {t("Create your shop")} <ArrowRight size={17} />
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
