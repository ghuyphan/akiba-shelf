import { useEffect, useRef } from "react";
import { useCatalogCopy } from "../../lib/catalogI18n";

type CategoryFiltersProps = {
  categories: string[];
  activeCategory: string;
  onChange: (category: string) => void;
};

export function CategoryFilters({ categories, activeCategory, onChange }: CategoryFiltersProps) {
  const copy = useCatalogCopy();
  const rowRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const row = rowRef.current;
    const activeIndex = categories.indexOf(activeCategory);
    const activeChip = chipRefs.current[activeIndex];
    if (!row || !activeChip) return;
    const currentRow = row;
    const currentActiveChip = activeChip;

    function updateIndicator() {
      requestAnimationFrame(() => {
        const rowRect = currentRow.getBoundingClientRect();
        const chipRect = currentActiveChip.getBoundingClientRect();
        if (rowRect.width === 0 || chipRect.width === 0) return;
        currentRow.style.setProperty("--active-left", `${chipRect.left - rowRect.left + currentRow.scrollLeft}px`);
        currentRow.style.setProperty("--active-width", `${chipRect.width}px`);
      });
    }

    updateIndicator();
    const observer = new ResizeObserver(updateIndicator);
    observer.observe(currentRow);
    observer.observe(currentActiveChip);
    window.addEventListener("resize", updateIndicator);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [activeCategory, categories]);

  return (
    <div className="category-row" ref={rowRef} aria-label="Product categories">
      {categories.map((category) => (
        <button
          key={category}
          ref={(element) => {
            chipRefs.current[categories.indexOf(category)] = element;
          }}
          className={`chip ${category === activeCategory ? "chip-active" : ""}`}
          type="button"
          onClick={() => onChange(category)}
        >
          {category === "All" ? copy.all : category}
        </button>
      ))}
    </div>
  );
}
