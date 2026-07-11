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

  return (
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
  );
}
