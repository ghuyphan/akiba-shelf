import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCatalogCopy } from "../../../lib/i18n/catalogI18n";
import { useTabIndicator } from "../../../hooks/shared/useTabIndicator";

type CategoryFiltersProps = {
  categories: string[];
  activeCategory: string;
  onChange: (category: string) => void;
};

export function CategoryFilters({ categories, activeCategory, onChange }: CategoryFiltersProps) {
  const copy = useCatalogCopy();
  const { containerRef, registerItem } = useTabIndicator<string, HTMLDivElement>(activeCategory, [categories]);
  const [scrollState, setScrollState] = useState({ hasOverflow: false, atStart: true, atEnd: true });
  const dragRef = useRef({ pointerId: -1, startX: 0, startScrollLeft: 0, moved: false });
  const [isDragging, setIsDragging] = useState(false);

  const updateScrollState = useCallback(() => {
    const row = containerRef.current;
    if (!row) return;
    const maxScroll = row.scrollWidth - row.clientWidth;
    setScrollState({
      hasOverflow: maxScroll > 2,
      atStart: row.scrollLeft <= 2,
      atEnd: row.scrollLeft >= maxScroll - 2,
    });
  }, [containerRef]);

  useEffect(() => {
    const row = containerRef.current;
    if (!row) return;
    updateScrollState();
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(row);
    row.querySelectorAll("button").forEach((button) => observer.observe(button));
    row.addEventListener("scroll", updateScrollState, { passive: true });
    const frame = requestAnimationFrame(updateScrollState);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      row.removeEventListener("scroll", updateScrollState);
    };
  }, [categories, containerRef, updateScrollState]);

  const scrollCategories = (direction: -1 | 1) => {
    const row = containerRef.current;
    row?.scrollBy({ left: direction * Math.max(160, row.clientWidth * 0.7), behavior: "smooth" });
  };

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const row = containerRef.current;
    if (!row || row.scrollWidth <= row.clientWidth) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: row.scrollLeft,
      moved: false,
    };
  };

  const drag = (event: React.PointerEvent<HTMLDivElement>) => {
    const row = containerRef.current;
    const state = dragRef.current;
    if (!row || state.pointerId !== event.pointerId) return;
    const distance = event.clientX - state.startX;
    if (!state.moved && Math.abs(distance) > 4) {
      state.moved = true;
      row.setPointerCapture(event.pointerId);
      setIsDragging(true);
    }
    if (!state.moved) return;
    row.scrollLeft = state.startScrollLeft - distance;
  };

  const stopDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    const row = containerRef.current;
    if (row?.hasPointerCapture(event.pointerId)) row.releasePointerCapture(event.pointerId);
    dragRef.current.pointerId = -1;
    setIsDragging(false);
  };

  return (
    <div className={`category-scroller${scrollState.hasOverflow ? " has-overflow" : ""}${scrollState.atStart ? " is-start" : ""}${scrollState.atEnd ? " is-end" : ""}`}>
      <button className="category-scroll-button category-scroll-previous" type="button" aria-label={copy.previousCategories} disabled={scrollState.atStart} onClick={() => scrollCategories(-1)}>
        <ChevronLeft size={16} />
      </button>
      <div
        className={`category-row${isDragging ? " is-dragging" : ""}`}
        ref={containerRef}
        aria-label={copy.productCategories}
        onPointerDown={startDrag}
        onPointerMove={drag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onClickCapture={(event) => {
          if (dragRef.current.moved) {
            event.preventDefault();
            event.stopPropagation();
            dragRef.current.moved = false;
          }
        }}
      >
        {categories.map((category) => (
          <button
            key={category}
            ref={registerItem(category)}
            className={`chip ${category === activeCategory ? "chip-active" : ""}`}
            type="button"
            aria-pressed={category === activeCategory}
            onClick={() => onChange(category)}
          >
            {category === "All" ? copy.all : category}
          </button>
        ))}
      </div>
      <button className="category-scroll-button category-scroll-next" type="button" aria-label={copy.nextCategories} disabled={scrollState.atEnd} onClick={() => scrollCategories(1)}>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
