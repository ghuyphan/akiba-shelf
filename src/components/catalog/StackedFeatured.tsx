import React, { useState, useRef } from "react";
import { ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";
import { Product } from "../../types/catalog";
import { formatVnd } from "../../lib/format";

type StackedFeaturedProps = {
  products: Product[];
  onSelect: (product: Product, event?: React.MouseEvent) => void;
};

export function StackedFeatured({ products, onSelect }: StackedFeaturedProps) {
  const [active, setActive] = useState(0);
  const dragStartRef = useRef<number | null>(null);
  const touchStartRef = useRef<number | null>(null);

  // Filter active and in-stock featured items
  const featured = products.filter(p => p.featured && p.quantity_available > 0 && p.active !== false);

  if (featured.length === 0) return null;

  const next = () => {
    setActive((prev) => (prev + 1) % featured.length);
  };

  const prev = () => {
    setActive((prev) => (prev - 1 + featured.length) % featured.length);
  };

  const handleNextClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    next();
  };

  const handlePrevClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    prev();
  };

  // Swipe / Drag Gestures support
  const swipeThreshold = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStartRef.current - touchEnd;

    if (diff > swipeThreshold) {
      next();
    } else if (diff < -swipeThreshold) {
      prev();
    }
    touchStartRef.current = null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    dragStartRef.current = e.clientX;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (dragStartRef.current === null) return;
    const diff = dragStartRef.current - e.clientX;

    if (diff > swipeThreshold) {
      next();
    } else if (diff < -swipeThreshold) {
      prev();
    }
    dragStartRef.current = null;
  };

  const activeProduct = featured[active];

  return (
    <section className="stacked-playground-section" onClick={(e) => e.stopPropagation()}>
      <div className="stacked-playground-grid">
        {/* Left Column: Active Item Details & Navigation */}
        <div className="stacked-details-col">
          <div className="stacked-badge-container">
            <span className="stacked-collection-badge">
              {activeProduct.collection || "Featured Drop"}
            </span>
          </div>
          
          <h2 className="stacked-title" title={activeProduct.name}>{activeProduct.name}</h2>

          <p className="stacked-description" title={activeProduct.description}>
            {activeProduct.description || "Special release item. Limited stock available."}
          </p>

          <div className="stacked-price-row">
            <span className="stacked-price">{formatVnd(activeProduct.price_vnd)}</span>
            <span className="stacked-stock-note">
              Only {activeProduct.quantity_available} left
            </span>
          </div>

          <div className="stacked-actions-row">
            <button
              type="button"
              className="stacked-add-btn"
              onClick={(e) => onSelect(activeProduct, e)}
            >
              <ShoppingBag size={16} />
              Add to Cart
            </button>
            
            <div className="stacked-nav-buttons">
              <button 
                type="button" 
                className="stacked-nav-arrow" 
                onClick={handlePrevClick}
                aria-label="Previous featured item"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="stacked-counter">
                {active + 1} / {featured.length}
              </span>
              <button 
                type="button" 
                className="stacked-nav-arrow" 
                onClick={handleNextClick}
                aria-label="Next featured item"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Rotated 3D Cards Stack (Swipeable & Draggable) */}
        <div 
          className="stacked-deck-col"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          style={{ userSelect: "none" }}
        >
          <div className="stacked-deck-container">
            {featured.map((slide, index) => {
              const offset = getOffset(index, active, featured.length);
              const isTop = offset === 0;
              const img = slide.images[0];

              return (
                <div
                  key={slide.id}
                  className={`playground-stack-card ${isTop ? "is-active" : ""}`}
                  style={{
                    transform: `
                      translateX(${offset * 18}px)
                      translateY(${Math.abs(offset) * 10}px)
                      rotate(${offset * 4}deg)
                      scale(${1 - Math.abs(offset) * 0.05})
                    `,
                    zIndex: 20 - Math.abs(offset),
                    opacity: Math.abs(offset) > 2 ? 0 : 1,
                  }}
                  onClick={(e) => {
                    if (!isTop) {
                      e.stopPropagation();
                      setActive(index);
                    }
                  }}
                  draggable="false"
                >
                  <div className="playground-card-image-wrap" draggable="false">
                    {img ? (
                      <img src={img} alt={slide.name} loading="lazy" draggable="false" />
                    ) : (
                      <div className="image-placeholder" />
                    )}
                    {slide.badge && (
                      <span className="playground-card-badge">{slide.badge}</span>
                    )}
                  </div>
                  <div className="playground-card-footer-title">
                    <h4>{slide.name}</h4>
                    <span>{formatVnd(slide.price_vnd)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// Math helper to handle circular offsets in the card stack loop
function getOffset(index: number, active: number, total: number) {
  let offset = index - active;
  if (offset > total / 2) offset -= total;
  if (offset < -total / 2) offset += total;
  return offset;
}
