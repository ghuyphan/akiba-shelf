import { ArrowDownUp, Grid2X2, List, Search, X } from "lucide-react";
import { useCatalogCopy } from "../../lib/i18n/catalogI18n";
import type { PublicProductSort } from "../../lib/api";
import { SelectMenu } from "../ui/SelectMenu";

type CatalogToolbarProps = {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sort: PublicProductSort;
  viewMode: "grid" | "list";
  onSortChange: (sort: PublicProductSort) => void;
  onViewModeChange: (mode: "grid" | "list") => void;
};

export function CatalogToolbar({
  searchQuery,
  onSearchChange,
  sort,
  viewMode,
  onSortChange,
  onViewModeChange,
}: CatalogToolbarProps) {
  const copy = useCatalogCopy();
  const sortOptions: { value: PublicProductSort; label: string }[] = [
    { value: "recommended", label: copy.recommended },
    { value: "price-asc", label: copy.priceLow },
    { value: "price-desc", label: copy.priceHigh },
    { value: "quantity", label: copy.mostStock },
    { value: "name", label: copy.name },
  ];
  return (
    <div className="catalog-toolbar">
      <div className={`search-control${searchQuery ? " search-active" : ""}`}>
        <Search size={16} className="search-icon" />
        <input
          type="text"
          placeholder={copy.searchItems}
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          aria-label={copy.searchCatalog}
        />
        {searchQuery && (
          <button
            type="button"
            className="search-clear"
            aria-label={copy.clearSearch}
            onClick={() => onSearchChange("")}
          >
            <X size={14} />
          </button>
        )}
      </div>

      <SelectMenu
        className="sort-control-select"
        label={copy.sortBy}
        value={sort}
        options={sortOptions}
        triggerIcon={<ArrowDownUp size={15} />}
        onChange={(value) => onSortChange(value as PublicProductSort)}
      />

      <div className="view-toggle" aria-label={copy.viewModeLabel}>
        <button
          type="button"
          className={viewMode === "grid" ? "active" : ""}
          aria-label={copy.gridView}
          aria-pressed={viewMode === "grid"}
          onClick={() => onViewModeChange("grid")}
        >
          <Grid2X2 size={16} />
        </button>
        <button
          type="button"
          className={viewMode === "list" ? "active" : ""}
          aria-label={copy.listView}
          aria-pressed={viewMode === "list"}
          onClick={() => onViewModeChange("list")}
        >
          <List size={16} />
        </button>
      </div>
    </div>
  );
}
