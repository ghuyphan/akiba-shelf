import { Link } from "react-router";
import { useEffect, useRef } from "react";
import {
  ArrowRight,
  ClipboardCheck,
  Heart,
  LogIn,
  PackageCheck,
  Palette,
  ScanLine,
  ShoppingBag,
  Store,
} from "lucide-react";
import { AppHeader } from "../../components/ui/AppHeader";
import { PlatformFooter } from "../../components/platform/PlatformFooter";
import { PlatformHeaderBrand } from "../../components/platform/PlatformHeaderBrand";
import { PlatformLanguageToggle } from "../../components/platform/PlatformLanguageToggle";
import {
  ArtistPaletteArt,
  BenefitBadgeArt,
  ClipboardClampArt,
  DoodleSparkleArt,
  GachaCapsuleArt,
  HighlighterStrokeArt,
  PaperClipArt,
  PushPinArt,
  WashiTapeArt,
} from "../../components/platform/LandingArt";
import { PLATFORM_BRAND } from "../../lib/branding";
import { usePlatformI18n } from "../../lib/i18n/platformI18n";
import "../../styles/admin/admin.css";

export function HomePage() {
  const { t } = usePlatformI18n();
  const landingContentRef = useRef<HTMLElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = landingContentRef.current;
    if (!root) return;
    const sections = Array.from(
      root.querySelectorAll<HTMLElement>("[data-home-reveal]"),
    );
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      sections.forEach((section) => section.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 },
    );
    sections.forEach((section) => observer.observe(section));

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const totalHeight =
            document.documentElement.scrollHeight - window.innerHeight;
          if (totalHeight > 0 && progressBarRef.current) {
            const ratio = Math.min(1, Math.max(0, window.scrollY / totalHeight));
            progressBarRef.current.style.transform = `scaleX(${ratio})`;
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div className="admin-shell platform-home-shell platform-home-landing">
      <div
        ref={progressBarRef}
        className="platform-home-scroll-progress"
        aria-hidden="true"
      />
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

      <main
        ref={landingContentRef}
        className="admin-container platform-home-container"
      >
        <section className="platform-home-hero is-visible" data-home-reveal>
          <div className="platform-home-hero-copy">
            <span className="platform-home-kicker">
              {t("A storefront built for artist booths")}
            </span>
            <h1>
              {t("Sell merch.")}{" "}
              <span>
                {t("Keep orders under control.")}
                <HighlighterStrokeArt className="platform-landing-title-underline" />
              </span>
            </h1>
            <p>
              {t(
                "Fans order on their phones. Your team sees stock, payment, and pickup status in one place.",
              )}
            </p>
            <div className="platform-home-hero-actions">
              <Link
                to="/auth"
                className="button button-primary platform-home-cta"
              >
                {t("Set up your booth")} <ArrowRight size={17} />
              </Link>
              <Link to="/s/demo-booth" className="button platform-home-demo">
                <Store size={17} /> {t("See the demo booth")}
              </Link>
            </div>
          </div>

          <figure className="platform-home-hero-preview">
            <WashiTapeArt
              pattern="grid"
              color="rgba(244, 207, 120, 0.85)"
              className="platform-home-preview-tape"
              width={112}
              height={28}
            />
            <PaperClipArt
              variant="rosegold"
              className="platform-home-preview-clip"
              width={26}
              height={52}
            />
            <DoodleSparkleArt
              size={22}
              className="platform-home-preview-sparkle"
            />
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
          data-home-reveal
          aria-label={t("Why artists use Matsuri")}
        >
          <article>
            <div className="platform-home-benefit-badge">
              <BenefitBadgeArt kind="scan" />
            </div>
            <b>{t("Scan to shop")}</b>
            <span>{t("Fans browse and order from their phones")}</span>
          </article>
          <article>
            <div className="platform-home-benefit-badge">
              <BenefitBadgeArt kind="stock" />
            </div>
            <b>{t("Accurate stock")}</b>
            <span>{t("Items are held as soon as an order is placed")}</span>
          </article>
          <article>
            <div className="platform-home-benefit-badge">
              <BenefitBadgeArt kind="orders" />
            </div>
            <b>{t("One order list")}</b>
            <span>{t("Your team always knows what to pack next")}</span>
          </article>
          <article>
            <div className="platform-home-benefit-badge">
              <BenefitBadgeArt kind="style" />
            </div>
            <b>{t("Your booth, your style")}</b>
            <span>{t("Use your colors, artwork, and sections")}</span>
          </article>
        </section>

        <section className="platform-home-flow" id="how" data-home-reveal>
          <header>
            <h2>{t("From QR scan to pickup, all in one flow.")}</h2>
            <p>
              {t(
                "Simple for customers. Clear for whoever is packing orders behind the table.",
              )}
            </p>
          </header>
          <div className="platform-home-flow-list">
            <article>
              <WashiTapeArt
                pattern="dots"
                color="rgba(244, 207, 120, 0.78)"
                className="platform-home-flow-tape"
                width={84}
                height={24}
              />
              <PaperClipArt
                variant="silver"
                className="platform-home-flow-clip"
                width={22}
                height={45}
              />
              <span>
                <ScanLine size={25} strokeWidth={1.8} />
              </span>
              <div>
                <h3>{t("Scan and shop")}</h3>
                <p>
                  {t(
                    "Customers open your catalog, browse products, and order from their phone.",
                  )}
                </p>
              </div>
            </article>
            <article>
              <WashiTapeArt
                pattern="grid"
                color="rgba(171, 217, 199, 0.82)"
                className="platform-home-flow-tape"
                width={84}
                height={24}
              />
              <span>
                <ShoppingBag size={25} strokeWidth={1.8} />
              </span>
              <div>
                <h3>{t("Reserve stock")}</h3>
                <p>
                  {t(
                    "Matsuri checks the latest price and stock before holding items and showing VietQR.",
                  )}
                </p>
              </div>
            </article>
            <article>
              <WashiTapeArt
                pattern="stripes"
                color="rgba(247, 183, 163, 0.8)"
                className="platform-home-flow-tape"
                width={84}
                height={24}
              />
              <PaperClipArt
                variant="rosegold"
                className="platform-home-flow-clip"
                width={22}
                height={45}
              />
              <span>
                <ClipboardCheck size={25} strokeWidth={1.8} />
              </span>
              <div>
                <h3>{t("Pack and hand over")}</h3>
                <p>
                  {t(
                    "Every order appears in the same live list, ready for payment checks, packing, and pickup.",
                  )}
                </p>
              </div>
            </article>
          </div>
        </section>

        <section className="platform-home-toolkit" id="tools" data-home-reveal>
          <div className="platform-home-toolkit-copy">
            <span>{t("For both sides of the table")}</span>
            <h2>
              {t("A storefront for customers. One order screen for your team.")}
            </h2>
            <p>
              {t(
                "Make the storefront feel like your booth. Behind the table, keep payment, stock, and pickup details together.",
              )}
            </p>
            <ul>
              <li>{t("Use your own artwork, colors, and booth style")}</li>
              <li>{t("Let everyone see the latest order status")}</li>
              <li>
                {t("Stop the same item from being sold twice during a rush")}
              </li>
            </ul>
          </div>
          <aside
            className="platform-home-pinboard"
            aria-label={t("Matsuri workspace preview")}
          >
            <article className="platform-home-pinboard-orders">
              <PushPinArt
                color="coral"
                className="platform-home-pinboard-pin"
                size={26}
              />
              <PaperClipArt
                variant="gold"
                className="platform-home-pinboard-clip"
                width={22}
                height={44}
              />
              <span>
                <ClipboardCheck size={15} strokeWidth={1.8} />
                {t("Orders")}
              </span>
              <strong>
                {t("Pending, paid, and completed orders in one list")}
              </strong>
            </article>
            <article className="platform-home-pinboard-stock">
              <PushPinArt
                color="mint"
                className="platform-home-pinboard-pin"
                size={26}
              />
              <span>
                <PackageCheck size={15} strokeWidth={1.8} />
                {t("Stock")}
              </span>
              <strong>{t("Held as soon as an order comes in")}</strong>
            </article>
            <article className="platform-home-pinboard-design">
              <PushPinArt
                color="yellow"
                className="platform-home-pinboard-pin"
                size={26}
              />
              <PaperClipArt
                variant="mint"
                className="platform-home-pinboard-clip-design"
                width={22}
                height={44}
              />
              <span>
                <Palette size={15} strokeWidth={1.8} />
                {t("Storefront")}
              </span>
              <strong>{t("Your colors, logo, and layout")}</strong>
            </article>
          </aside>
        </section>

        <section className="platform-home-surfaces" id="demo" data-home-reveal>
          <header>
            <span>{t("See Matsuri in action")}</span>
            <h2>{t("One booth, three ways to use it.")}</h2>
            <p>
              {t(
                "Sell from a public catalog, manage pickups in admin, and add an optional gacha game using the same products.",
              )}
            </p>
          </header>
          <div className="platform-home-demo-table">
            <Link
              to="/auth?mode=signin"
              className="platform-home-demo-piece platform-home-demo-admin"
            >
              <ClipboardClampArt className="platform-home-demo-clamp" />
              <PaperClipArt
                variant="rosegold"
                className="platform-home-demo-admin-clip"
                width={24}
                height={48}
              />
              <div className="platform-home-demo-heading">
                <span>{t("Order desk")}</span>
                <h3>{t("Everything ready for pickup")}</h3>
              </div>
              <div className="platform-home-demo-media">
                <img
                  src="/landing/demo-admin.png"
                  alt={t(
                    "Matsuri order screen with payment and pickup details",
                  )}
                  width="1280"
                  height="640"
                  loading="lazy"
                />
              </div>
              <footer>
                <p>
                  {t(
                    "Check payment, stock, and pickup status even when the booth gets busy.",
                  )}
                </p>
                <b>
                  {t("Open the order desk")} <ArrowRight size={15} />
                </b>
              </footer>
            </Link>

            <Link
              to="/s/demo-booth"
              className="platform-home-demo-piece platform-home-demo-store"
            >
              <WashiTapeArt
                pattern="grid"
                color="rgba(244, 207, 120, 0.85)"
                className="platform-home-demo-tape"
                width={96}
                height={26}
              />
              <div className="platform-home-demo-heading">
                <span>{t("Online catalog")}</span>
                <h3>{t("Your art stays front and center")}</h3>
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
              <PaperClipArt
                variant="mint"
                className="platform-home-demo-gacha-clip"
                width={22}
                height={44}
              />
              <GachaCapsuleArt
                size={34}
                className="platform-home-demo-gacha-capsule"
              />
              <div className="platform-home-demo-heading">
                <span>{t("Event minigame")}</span>
                <h3>{t("Give fans one more reason to stop by")}</h3>
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

        <section className="platform-home-final" data-home-reveal>
          <WashiTapeArt
            pattern="dots"
            color="rgba(244, 207, 120, 0.82)"
            className="platform-home-final-tape"
            width={120}
            height={28}
          />
          <DoodleSparkleArt
            size={24}
            color="var(--landing-coral)"
            className="platform-home-final-sparkle"
          />
          <h2>{t("Ready to put your booth online?")}</h2>
          <Link to="/auth" className="button button-primary platform-home-cta">
            {t("Set up your booth")} <ArrowRight size={17} />
          </Link>
        </section>

        <aside
          className="platform-home-support"
          data-home-reveal
          aria-label={t("Support Matsuri")}
        >
          <div className="platform-home-support-art" aria-hidden="true">
            <ArtistPaletteArt className="platform-home-support-palette-art" />
          </div>
          <div className="platform-home-support-copy">
            <span className="platform-home-support-label">
              <Heart size={13} fill="currentColor" />
              {t("Community supported")}
            </span>
            <h2>{t("Keep Matsuri free for artists.")}</h2>
            <p>
              {t(
                "Matsuri is free for artists. Optional support covers hosting and maintenance.",
              )}
            </p>
          </div>
          <Link to="/support" className="platform-home-support-button">
            {t("Support Matsuri")}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </aside>
      </main>

      <PlatformFooter showSupportLink={false} showDemoLink={true} />
    </div>
  );
}
