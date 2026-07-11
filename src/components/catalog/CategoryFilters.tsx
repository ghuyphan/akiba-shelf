import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useCatalogCopy } from "../../lib/catalogI18n";
import { useTabIndicator } from "../../hooks/useTabIndicator";

type CategoryFiltersProps = {
  categories: string[];
  activeCategory: string;
  onChange: (category: string) => void;
};

export function CategoryFilters({ categories, activeCategory, onChange }: CategoryFiltersProps) {
  const copy = useCatalogCopy();
  const { containerRef, registerItem } = useTabIndicator<string, HTMLDivElement>(activeCategory, [categories]);
  const [scrollState, setScrollState] = useState({ hasOverflow: false, atStart: true, atEnd: true });

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
    row.addEventListener("scroll", updateScrollState, { passive: true });
    return () => {
      observer.disconnect();
      row.removeEventListener("scroll", updateScrollState);
    };
  }, [categories, containerRef, updateScrollState]);

  const scrollCategories = (direction: -1 | 1) => {
    const row = containerRef.current;
    row?.scrollBy({ left: direction * Math.max(160, row.clientWidth * 0.7), behavior: "smooth" });
  };

  return (
    <div className={`category-scroller${scrollState.hasOverflow ? " has-overflow" : ""}${scrollState.atStart ? " is-start" : ""}${scrollState.atEnd ? " is-end" : ""}`}>
      <button className="category-scroll-button category-scroll-previous" type="button" aria-label={copy.previousCategories} disabled={scrollState.atStart} onClick={() => scrollCategories(-1)}>
        <ChevronLeft size={16} />
      </button>
      <div className="category-row" ref={containerRef} aria-label="Product categories">
        {categories.map((category) => (
          <button
            key={category}
            ref={registerItem(category)}
            className={`chip ${category === activeCategory ? "chip-active" : ""}`}
            type="button"
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
