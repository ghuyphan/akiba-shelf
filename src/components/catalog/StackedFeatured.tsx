import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, PackageCheck, ShoppingCart, Sparkles } from "lucide-react";
import type { Product } from "../../types/catalog";
import { formatVnd } from "../../lib/format";
import { useCatalogCopy } from "../../lib/catalogI18n";

type StackedFeaturedProps = {
  products: Product[];
  onSelect: (product: Product, event?: React.MouseEvent) => void;
  autoRotate?: boolean;
};

export function StackedFeatured({ products, onSelect, autoRotate = true }: StackedFeaturedProps) {
  const copy = useCatalogCopy();
  const [active, setActive] = useState(0);
  const dragStartRef = useRef<number | null>(null);
  const touchStartRef = useRef<number | null>(null);
  const autoScrollPausedRef = useRef(false);
  const autoScrollResumeAtRef = useRef(0);
  const featured = products.filter((product) => product.featured && product.quantity_available > 0 && product.active !== false);

  useEffect(() => {
    if (active >= featured.length) setActive(0);
  }, [active, featured.length]);

  useEffect(() => {
    if (!autoRotate || featured.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const interval = window.setInterval(() => {
      if (autoScrollPausedRef.current || Date.now() < autoScrollResumeAtRef.current || document.hidden) return;
      setActive((current) => (current + 1) % featured.length);
    }, 4500);

    return () => window.clearInterval(interval);
  }, [autoRotate, featured.length]);

  if (featured.length === 0) {
    if (products.length === 0) {
      return (
        <section className="booth-card booth-card-redesign featured-banner-empty" onClick={(e) => e.stopPropagation()}>
          <div className="booth-card-topline">
            <span>Featured spotlight</span>
            <small style={{ color: autoRotate ? "color-mix(in srgb, var(--coral) 75%, var(--muted))" : "var(--muted)" }}>
              <i style={{
                background: autoRotate ? "var(--coral)" : "var(--muted)",
                boxShadow: autoRotate ? "0 0 0 4px color-mix(in srgb, var(--coral) 12%, transparent)" : "none"
              }} />
              {autoRotate ? "Spotlight active" : "Spotlight static"}
            </small>
          </div>
          <div className="booth-hero booth-card-identity" style={{ borderBottom: "0", paddingBottom: "0" }}>
            <div className="booth-hero-logo" style={{ color: "var(--coral)", background: "color-mix(in srgb, var(--coral) 8%, #fff)" }}>
              <Sparkles size={22} />
            </div>
            <div className="booth-hero-info">
              <strong className="booth-hero-name">No featured items yet</strong>
              <span className="booth-hero-code">Hand-picked items and special bundles will appear here in the spotlight deck.</span>
            </div>
          </div>
        </section>
      );
    }
    return null;
  }

  const activeProduct = featured[active] ?? featured[0];
  const next = () => setActive((current) => (current + 1) % featured.length);
  const previous = () => setActive((current) => (current - 1 + featured.length) % featured.length);
  const swipeThreshold = 48;

  function pauseAfterInteraction() {
    autoScrollResumeAtRef.current = Date.now() + 6000;
  }

  function finishSwipe(endX: number, startX: number | null) {
    if (startX === null || featured.length < 2) return;
    const distance = startX - endX;
    if (Math.abs(distance) > swipeThreshold) pauseAfterInteraction();
    if (distance > swipeThreshold) next();
    if (distance < -swipeThreshold) previous();
  }

  return (
    <section
      className="featured-banner"
      aria-label="Featured merchandise"
      onClick={(event) => event.stopPropagation()}
      onMouseEnter={() => { autoScrollPausedRef.current = true; }}
      onMouseLeave={() => { autoScrollPausedRef.current = false; }}
      onFocusCapture={() => { autoScrollPausedRef.current = true; }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) autoScrollPausedRef.current = false;
      }}
      onTouchStart={(event) => { touchStartRef.current = event.targetTouches[0].clientX; }}
      onTouchEnd={(event) => { finishSwipe(event.changedTouches[0].clientX, touchStartRef.current); touchStartRef.current = null; }}
    >
      <div className="featured-banner-inner">
        <div className="featured-banner-copy">
          <div className="featured-banner-topline">
            <span className="featured-banner-kicker"><Sparkles size={14} /> {copy.featuredDrop}</span>
            {featured.length > 1 && <span className="featured-banner-count">{String(active + 1).padStart(2, "0")} / {String(featured.length).padStart(2, "0")}</span>}
          </div>
          <span className="featured-banner-collection">{activeProduct.collection || activeProduct.category || copy.limitedCollection}</span>
          <h2>{activeProduct.name}</h2>
          <p>{activeProduct.description || copy.specialRelease}</p>
          <div className="featured-banner-meta">
            <strong>{formatVnd(activeProduct.price_vnd)}</strong>
            <span><PackageCheck size={15} /> {activeProduct.quantity_available > 10 ? copy.inStock : copy.onlyLeft(activeProduct.quantity_available)}</span>
          </div>
          <div className="featured-banner-actions">
            <button type="button" className="featured-banner-add" onClick={(event) => onSelect(activeProduct, event)}><ShoppingCart size={17} /><span>{copy.addToCart}</span></button>
            {featured.length > 1 && <div className="featured-banner-nav"><button type="button" onClick={(event) => { event.stopPropagation(); pauseAfterInteraction(); previous(); }} aria-label="Previous featured item"><ChevronLeft size={18} /></button><div>{featured.map((product, index) => <button key={product.id} type="button" className={index === active ? "active" : ""} onClick={(event) => { event.stopPropagation(); pauseAfterInteraction(); setActive(index); }} aria-label={`Show ${product.name}`} />)}</div><button type="button" onClick={(event) => { event.stopPropagation(); pauseAfterInteraction(); next(); }} aria-label="Next featured item"><ChevronRight size={18} /></button></div>}
          </div>
        </div>

        <div
          className="featured-banner-media featured-banner-deck-media"
          onMouseDown={(event) => { dragStartRef.current = event.clientX; }}
          onMouseUp={(event) => { finishSwipe(event.clientX, dragStartRef.current); dragStartRef.current = null; }}
          onMouseLeave={() => { dragStartRef.current = null; }}
        >
          <div className="featured-card-deck">
            {featured.map((product, index) => {
              const offset = getFeaturedOffset(index, active, featured.length);
              if (Math.abs(offset) > 1) return null;
              const isActive = offset === 0;
              const image = product.image_variants?.[0]?.thumbnail || product.images.find(Boolean);
              return (
                <button
                  key={product.id}
                  type="button"
                  className={`featured-deck-card ${isActive ? "is-active" : ""}`}
                  style={{
                    transform: `translate(-50%, -50%) translateX(${offset * 22}px) translateY(${Math.abs(offset) * 11}px) rotate(${offset * 5}deg) scale(${1 - Math.min(Math.abs(offset), 3) * .055})`,
                    zIndex: 20 - Math.abs(offset),
                    opacity: Math.abs(offset) > 2 ? 0 : 1,
                  }}
                  onClick={(event) => { event.stopPropagation(); if (!isActive) { pauseAfterInteraction(); setActive(index); } }}
                  aria-label={isActive ? `${product.name}, current featured item` : `Show ${product.name}`}
                  tabIndex={isActive ? 0 : -1}
                >
                  <span className="featured-deck-image">{image ? <img src={image} alt={isActive ? product.name : ""} draggable="false" loading={isActive ? "eager" : "lazy"} fetchPriority={isActive ? "high" : "low"} decoding="async" /> : <span className="image-placeholder" />}{product.badge && <i style={{ backgroundColor: product.badge_color || undefined }}>{product.badge}</i>}</span>
                  <span className="featured-deck-footer"><strong>{product.name}</strong><small>{formatVnd(product.price_vnd)}</small></span>
                </button>
              );
            })}
          </div>
          <span className="featured-banner-swipe-hint" aria-label={copy.swipeToBrowse}><SwipeGestureIcon /></span>
        </div>
      </div>
    </section>
  );
}

function SwipeGestureIcon() {
  return (
    <svg
      viewBox="0 0 118.89 124.52"
      width="14"
      height="14"
      fill="currentColor"
    >
      <path d="M42.58,69.16a2.52,2.52,0,0,1-.48-.3c-2-1.55-4.09-3.28-5.94-4.8-2.69-2.21-5.79-4.76-8-6.57a11.36,11.36,0,0,0-4.76-2.4,5.07,5.07,0,0,0-2.69.11,2.82,2.82,0,0,0-1.44,1.48A9.48,9.48,0,0,0,18.75,61a16.75,16.75,0,0,0,1.48,5.35A33.68,33.68,0,0,0,24.14,73a1,1,0,0,1,.18.3L47.67,106.6a2.93,2.93,0,0,1,.52,1.4c.48,3.84,1.29,6.75,2.47,8.56a3.81,3.81,0,0,0,3.43,2H90.83a11,11,0,0,0,6.27-2,20.06,20.06,0,0,0,5.72-6.71s.07-.11.11-.15c.66-1.14,1.55-2.62,2.4-4,3.73-6.12,7-11.47,7.34-19.07l-.22-10.48a1.64,1.64,0,0,1,0-.44c0-.15,0-1.14,0-2.47.07-6.93.18-15.49-6.16-16.56H102.2c0,2-.15,4-.26,5.87-.11,1.73-.22,3.36-.22,4.94a3.06,3.06,0,1,1-6.12,0c0-1.59.11-3.43.22-5.35.41-6.53.89-14-4.32-14.94H87.44a4.93,4.93,0,0,1-.66-.07c0,2.36-.11,4.8-.26,7.16-.11,1.73-.22,3.36-.22,4.94a3.06,3.06,0,0,1-6.12,0c0-1.59.11-3.43.22-5.35.41-6.53.88-14-4.32-14.94H72a3,3,0,0,1-.81-.11V50.65a3.06,3.06,0,1,1-6.12,0v-32c0-5.35-2.18-8.74-5-10.14a7.15,7.15,0,0,0-3.21-.77,7.28,7.28,0,0,0-3.21.77c-2.77,1.4-4.91,4.8-4.91,10.29v56a3.06,3.06,0,0,1-6.12,0V69.16ZM12.29,28.69a2.61,2.61,0,0,0,3.78-3.6L8.7,17.38H30.84a2.61,2.61,0,1,0,0-5.22H8.7l7.38-7.75A2.61,2.61,0,0,0,12.3.81L.72,13a2.62,2.62,0,0,0,0,3.6L12.29,28.69ZM102.52.81a2.61,2.61,0,1,0-3.78,3.6l7.37,7.71H84a2.61,2.61,0,1,0,0-5.22h22.14l-7.38,7.75a2.61,2.61,0,0,0,3.78,3.6l11.58-12.16a2.62,2.62,0,0,0,0-3.6L102.52.81Zm-31.32,32a3,3,0,0,1,.81-.11h4.24a5.53,5.53,0,0,1,.7.07c5.64.89,8.19,4.17,9.22,8.45a3.24,3.24,0,0,1,1.29-.3H91.7a5.53,5.53,0,0,1,.7.07c6.09,1,8.52,4.68,9.41,9.41a1.83,1.83,0,0,1,.48,0h4.24a5.53,5.53,0,0,1,.7.07c11.66,1.81,11.51,13.39,11.4,22.72v2.43l.26,10.77v.33c-.44,9.19-4.06,15.12-8.23,22-.7,1.14-1.4,2.32-2.36,4,0,0,0,.07-.07.11a26.19,26.19,0,0,1-7.56,8.71,17,17,0,0,1-9.7,3.1H54.27a9.62,9.62,0,0,1-8.6-4.65c-1.7-2.51-2.8-6-3.39-10.48L19.41,76.72l-.11-.11a42.42,42.42,0,0,1-4.61-7.78,23.05,23.05,0,0,1-2-7.41,15.16,15.16,0,0,1,1.07-7.23,8.62,8.62,0,0,1,4.76-4.65,10.52,10.52,0,0,1,6.16-.44,17.26,17.26,0,0,1,7.49,3.69c1.84,1.55,4.94,4.06,8,6.53l2.51,2.07V18.84c0-8.15,3.62-13.39,8.3-15.75a13.12,13.12,0,0,1,11.95,0c4.69,2.36,8.37,7.64,8.37,15.64V32.82l-.08,0Z" />
    </svg>
  );
}

function getFeaturedOffset(index: number, active: number, total: number) {
  let offset = index - active;
  if (offset > total / 2) offset -= total;
  if (offset < -total / 2) offset += total;
  return offset;
}
