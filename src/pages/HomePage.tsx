import { Link } from "react-router-dom";
import {
  ArrowRight,
  ClipboardCheck,
  LogIn,
  Palette,
  ScanLine,
  ShoppingBag,
  Store,
  Users,
} from "lucide-react";
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
        <section className="platform-landing-hero">
          <div className="platform-landing-hero-copy">
            <span className="platform-landing-kicker">
              <span aria-hidden="true">✦</span> Made for artists, not spreadsheets
            </span>
            <h1>
              Your art. Your booth. <span>Your little corner of the con.</span>
            </h1>
            <p>
              Matsuri turns your merch table into a friendly digital storefront,
              with live orders and accurate stock while you focus on meeting fans.
            </p>
            <div className="platform-landing-actions">
              <Link to="/auth" className="button button-primary platform-home-cta">
                Open your booth <ArrowRight size={17} />
              </Link>
              <Link to="/s/demo-booth" className="button platform-home-demo">
                <Store size={17} /> See the demo booth
              </Link>
            </div>
            <small className="platform-landing-note">
              <strong>No generic marketplace vibe.</strong> Your colors, your
              sections, your merch.
            </small>
          </div>

          <div className="platform-landing-art" aria-hidden="true">
            <div className="platform-landing-desk-shadow" />
            <span className="platform-landing-tape platform-landing-tape-one" />
            <span className="platform-landing-tape platform-landing-tape-two" />
            <div className="platform-landing-sketchbook">
              <div className="platform-landing-sketch-title">
                <span>
                  <strong>Arigato-san booth</strong>
                  <small>Artist Alley · Table B12</small>
                </span>
                <b>live today!</b>
              </div>
              <div className="platform-landing-mini-shop">
                <div className="platform-landing-poster">
                  <small>New festival drop</small>
                  <strong>tiny things, big feelings</strong>
                </div>
                <div className="platform-landing-product-stack">
                  <article>
                    <div className="pink">ACRYLIC STAND</div>
                    <footer><b>Moonlight Girl</b><span>120k</span></footer>
                  </article>
                  <article>
                    <div className="mint">STICKER SHEET</div>
                    <footer><b>Festival Cats</b><span>65k</span></footer>
                  </article>
                </div>
              </div>
            </div>
            <div className="platform-landing-phone">
              <div className="platform-landing-phone-notch" />
              <div className="platform-landing-phone-head"><span>Your order</span><span>♡</span></div>
              <div className="platform-landing-phone-list">
                {["Moonlight Stand", "Festival Cats", "Postcard Pack"].map((name, index) => (
                  <div className="platform-landing-phone-row" key={name}>
                    <i />
                    <span><strong>{name}</strong><small>Qty {index === 1 ? 2 : 1}</small></span>
                    <b>{["120k", "130k", "50k"][index]}</b>
                  </div>
                ))}
              </div>
              <div className="platform-landing-qr">
                <svg
                  viewBox="0 0 21 21"
                  role="img"
                  aria-label="Decorative checkout QR code"
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
            <span className="platform-landing-sticker pencil">DRAW MORE</span>
          </div>
        </section>

        <section className="platform-landing-ribbon" aria-label="Who Matsuri helps">
          <span><b>For fans</b>Browse and order from their phone</span>
          <span><b>For artists</b>Keep stock and payments together</span>
          <span><b>For helpers</b>Share one clear live order queue</span>
          <span><b>For your brand</b>Make the storefront feel like you</span>
        </section>

        <section className="platform-landing-section" id="how">
          <div className="platform-landing-section-head">
            <small>How the booth flows</small>
            <h2>Less table chaos. More time talking about your art.</h2>
            <p>A simple three-step flow that feels natural for customers and helpers.</p>
          </div>
          <div className="platform-landing-zine-grid">
            <article>
              <span>01</span><div><ScanLine size={27} /></div>
              <h3>Fans browse</h3>
              <p>They scan your booth QR, explore your collections, and add merch without blocking the table.</p>
            </article>
            <article>
              <span>02</span><div><ShoppingBag size={27} /></div>
              <h3>They order and pay</h3>
              <p>Matsuri reserves the items, calculates the total, and shows your VietQR payment details.</p>
            </article>
            <article>
              <span>03</span><div><ClipboardCheck size={27} /></div>
              <h3>You hand it over</h3>
              <p>The order appears live for your team, ready to confirm, pack, and give to the customer.</p>
            </article>
          </div>
        </section>

        <section className="platform-landing-section platform-landing-toolkit" id="tools">
          <div className="platform-landing-toolkit-copy">
            <span>Your booth toolkit</span>
            <h2>Designed like an artist’s workspace, not an enterprise dashboard.</h2>
            <p>Use a live storefront designer, keep a simple order queue, and invite helpers without giving everyone full control.</p>
            <ul>
              <li>Arrange banners, collections, and booth information</li>
              <li>Use your own colors, logo, and visual style</li>
              <li>See pending, paid, and completed orders in one place</li>
              <li>Give helpers only the access they need</li>
            </ul>
          </div>
          <div className="platform-landing-pinboard" aria-label="Matsuri workspace preview">
            <article className="orders-note">
              <small><ClipboardCheck size={13} /> Live orders</small>
              <strong>3 fans waiting</strong>
              <div><span><b>#A104</b><i>Moon Stand × 2</i></span><span><b>#A103</b><i>Sticker Pack × 1</i></span><span><b>#A102</b><i>Print Set × 1</i></span></div>
            </article>
            <article className="palette-note">
              <small><Palette size={13} /> Palette</small><strong>Match your art</strong>
              <div><i /><i /><i /><i /></div>
            </article>
            <article className="sections-note">
              <small><Users size={13} /> Storefront sections</small>
              <strong>Featured drop · Products · About the artist · Booth info</strong>
            </article>
          </div>
        </section>

        <section className="platform-landing-final">
          <div><small>Ready for your next event?</small><h2>Make a booth your fans will remember.</h2></div>
          <Link to="/auth" className="button button-primary platform-home-cta">Create your shop <ArrowRight size={17} /></Link>
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
