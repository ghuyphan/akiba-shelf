import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, PackageCheck, ShoppingCart, Sparkles } from "lucide-react";
import type { Product } from "../../types/catalog";
import { formatVnd } from "../../lib/format";
import { useCatalogCopy } from "../../lib/catalogI18n";

type StackedFeaturedProps = {
  products: Product[];
  onSelect: (product: Product, event?: React.MouseEvent) => void;
};

export function StackedFeatured({ products, onSelect }: StackedFeaturedProps) {
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
    if (featured.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const interval = window.setInterval(() => {
      if (autoScrollPausedRef.current || Date.now() < autoScrollResumeAtRef.current || document.hidden) return;
      setActive((current) => (current + 1) % featured.length);
    }, 4500);

    return () => window.clearInterval(interval);
  }, [featured.length]);

  if (featured.length === 0) return null;

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
            {activeProduct.badge && <span className="featured-banner-badge">{activeProduct.badge}</span>}
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
              const isActive = offset === 0;
              const image = product.images.find(Boolean);
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
                  <span className="featured-deck-image">{image ? <img src={image} alt={isActive ? product.name : ""} draggable="false" /> : <span className="image-placeholder" />}{product.badge && <i>{product.badge}</i>}</span>
                  <span className="featured-deck-footer"><strong>{product.name}</strong><small>{formatVnd(product.price_vnd)}</small></span>
                </button>
              );
            })}
          </div>
          <span className="featured-banner-swipe-hint">{copy.swipeToBrowse}</span>
        </div>
      </div>
    </section>
  );
}

function getFeaturedOffset(index: number, active: number, total: number) {
  let offset = index - active;
  if (offset > total / 2) offset -= total;
  if (offset < -total / 2) offset += total;
  return offset;
}
