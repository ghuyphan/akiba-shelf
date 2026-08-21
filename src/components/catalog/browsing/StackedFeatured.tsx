import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  MoveHorizontal,
  PackageCheck,
  ShoppingCart,
  Star,
} from "lucide-react";
import type { Product } from "../../../types/catalog";
import { selectStorefrontFeaturedProducts } from "../../../lib/catalogQueries";
import { useCatalogCopy } from "../../../lib/i18n/catalogLocale";
import { EmptyState } from "../../ui/EmptyState";
import { ProductPrice } from "./ProductPrice";

type StackedFeaturedProps = {
  products: Product[];
  onSelect: (product: Product, event?: React.MouseEvent) => void;
  autoRotate?: boolean;
  lightweightImages?: boolean;
};

export function StackedFeatured({
  products,
  onSelect,
  autoRotate = true,
  lightweightImages = false,
}: StackedFeaturedProps) {
  const copy = useCatalogCopy();
  const [active, setActive] = useState(0);
  const [loadedImageIds, setLoadedImageIds] = useState<Set<string>>(
    () => new Set(),
  );
  const dragStartRef = useRef<number | null>(null);
  const touchStartRef = useRef<number | null>(null);
  const autoScrollPausedRef = useRef(false);
  const autoScrollResumeAtRef = useRef(0);
  const featured = selectStorefrontFeaturedProducts(products);

  useEffect(() => {
    if (active >= featured.length) setActive(0);
  }, [active, featured.length]);

  useEffect(() => {
    if (
      !autoRotate ||
      featured.length < 2 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;

    let interval: number | undefined;
    const removeStartListeners = () => {
      window.removeEventListener("pointerdown", startAutoRotate);
      window.removeEventListener("keydown", startAutoRotate);
    };
    const rotate = () => {
      if (
        autoScrollPausedRef.current ||
        Date.now() < autoScrollResumeAtRef.current ||
        document.hidden
      )
        return;
      setActive((current) => (current + 1) % featured.length);
    };
    function startAutoRotate() {
      if (interval !== undefined) return;
      removeStartListeners();
      interval = window.setInterval(rotate, 4500);
    }

    window.addEventListener("pointerdown", startAutoRotate, {
      once: true,
      passive: true,
    });
    window.addEventListener("keydown", startAutoRotate, { once: true });

    return () => {
      removeStartListeners();
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [autoRotate, featured.length]);

  if (featured.length === 0) {
    if (products.length === 0) {
      return (
        <section
          className="booth-card booth-card-redesign featured-banner-empty"
        >
          <EmptyState
            variant="compact"
            icon={<Star size={24} />}
            title={copy.noFeatured}
            message={copy.noFeaturedHint}
          />
        </section>
      );
    }
    return null;
  }

  const activeProduct = featured[active] ?? featured[0];
  const next = () => setActive((current) => (current + 1) % featured.length);
  const previous = () =>
    setActive((current) => (current - 1 + featured.length) % featured.length);
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

  function markImageLoaded(productId: string) {
    setLoadedImageIds((current) => {
      if (current.has(productId)) return current;
      const nextLoaded = new Set(current);
      nextLoaded.add(productId);
      return nextLoaded;
    });
  }

  return (
    <section
      className="featured-banner"
      aria-label={copy.featuredMerchandise}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerEnter={() => {
        autoScrollPausedRef.current = true;
      }}
      onPointerLeave={() => {
        autoScrollPausedRef.current = false;
      }}
      onFocusCapture={() => {
        autoScrollPausedRef.current = true;
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          autoScrollPausedRef.current = false;
      }}
      onTouchStart={(event) => {
        touchStartRef.current = event.targetTouches[0].clientX;
      }}
      onTouchEnd={(event) => {
        finishSwipe(event.changedTouches[0].clientX, touchStartRef.current);
        touchStartRef.current = null;
      }}
    >
      <div className="featured-banner-inner">
        <div className="featured-banner-copy">
          <div className="featured-banner-topline">
            <span className="featured-banner-kicker">
              <Star size={14} strokeWidth={2.5} /> {copy.featuredDrop}
            </span>
            {featured.length > 1 && (
              <span className="featured-banner-count">
                {String(active + 1).padStart(2, "0")} /{" "}
                {String(featured.length).padStart(2, "0")}
              </span>
            )}
          </div>
          <span className="featured-banner-collection">
            {activeProduct.collection ||
              activeProduct.category ||
              copy.limitedCollection}
          </span>
          <h2>{activeProduct.name}</h2>
          <p>{activeProduct.description || copy.specialRelease}</p>
          <div className="featured-banner-meta">
            <ProductPrice product={activeProduct} />
            <span>
              <PackageCheck size={15} />{" "}
              {activeProduct.quantity_available > 10
                ? copy.inStock
                : copy.onlyLeft(activeProduct.quantity_available)}
            </span>
          </div>
          <div className="featured-banner-actions">
            <button
              type="button"
              className="featured-banner-add"
              aria-label={`${copy.addFeaturedSelection}: ${activeProduct.name}`}
              onClick={(event) => onSelect(activeProduct, event)}
            >
              <ShoppingCart size={17} />
              <span>{copy.addToCart}</span>
            </button>
            {featured.length > 1 && (
              <div className="featured-banner-nav">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    pauseAfterInteraction();
                    previous();
                  }}
                  aria-label={copy.previousFeatured}
                >
                  <ChevronLeft size={18} />
                </button>
                <div>
                  {featured.map((product, index) => (
                    <button
                      key={product.id}
                      type="button"
                      className={index === active ? "active" : ""}
                      onClick={(event) => {
                        event.stopPropagation();
                        pauseAfterInteraction();
                        setActive(index);
                      }}
                      aria-label={copy.showFeaturedItem(product.name)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    pauseAfterInteraction();
                    next();
                  }}
                  aria-label={copy.nextFeatured}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div
          className="featured-banner-media featured-banner-deck-media"
          onPointerDown={(event) => {
            dragStartRef.current = event.clientX;
          }}
          onPointerUp={(event) => {
            finishSwipe(event.clientX, dragStartRef.current);
            dragStartRef.current = null;
          }}
          onPointerLeave={() => {
            dragStartRef.current = null;
          }}
        >
          <div className="featured-card-deck">
            {featured.map((product, index) => {
              const offset = getFeaturedOffset(index, active, featured.length);
              if (Math.abs(offset) > 1) return null;
              const isActive = offset === 0;
              const variant = product.image_variants?.[0];
              const fallbackImage = product.images.find(Boolean);
              const image = variant?.thumbnail || fallbackImage;
              const shouldLoadImage =
                isActive || loadedImageIds.has(product.id);
              return (
                <button
                  key={product.id}
                  type="button"
                  className={`featured-deck-card ${isActive ? "is-active" : ""}`}
                  style={{
                    transform: `translate(-50%, -50%) translateX(${offset * 22}px) translateY(${Math.abs(offset) * 11}px) rotate(${offset * 5}deg) scale(${1 - Math.min(Math.abs(offset), 3) * 0.055})`,
                    zIndex: 20 - Math.abs(offset),
                    opacity: Math.abs(offset) > 2 ? 0 : 1,
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!isActive) {
                      pauseAfterInteraction();
                      setActive(index);
                    }
                  }}
                  aria-label={
                    isActive
                      ? copy.currentFeaturedItem(product.name)
                      : copy.showFeaturedItem(product.name)
                  }
                  tabIndex={isActive ? 0 : -1}
                >
                  <span className="featured-deck-image">
                    {image && shouldLoadImage ? (
                      <img
                        src={image}
                        srcSet={
                          variant && !lightweightImages
                            ? `${variant.thumbnail} 600w, ${variant.detail} 1400w`
                            : undefined
                        }
                        sizes="(max-width: 420px) 78vw, (max-width: 760px) 360px, 480px"
                        alt={isActive ? product.name : ""}
                        draggable="false"
                        loading={isActive ? "eager" : "lazy"}
                        fetchPriority={isActive ? "high" : "low"}
                        decoding="async"
                        onLoad={() => markImageLoaded(product.id)}
                      />
                    ) : (
                      <span className="image-placeholder" />
                    )}
                    {product.badge && (
                      <i
                        style={{
                          backgroundColor: product.badge_color || undefined,
                        }}
                      >
                        {product.badge}
                      </i>
                    )}
                  </span>
                  <span className="featured-deck-footer">
                    <strong>{product.name}</strong>
                    <ProductPrice product={product} />
                  </span>
                </button>
              );
            })}
          </div>
          <span
            className="featured-banner-swipe-hint"
            aria-label={copy.swipeToBrowse}
          >
            <SwipeGestureIcon />
          </span>
        </div>
      </div>
    </section>
  );
}

function SwipeGestureIcon() {
  return <MoveHorizontal size={14} aria-hidden="true" />;
}

function getFeaturedOffset(index: number, active: number, total: number) {
  let offset = index - active;
  if (offset > total / 2) offset -= total;
  if (offset < -total / 2) offset += total;
  return offset;
}
