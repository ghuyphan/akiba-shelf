import { ArrowDownUp, Grid2X2, List, Search, X } from "lucide-react";
import { SelectInput } from "../ui/Field";

type CatalogToolbarProps = {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sort: string;
  viewMode: "grid" | "list";
  onSortChange: (sort: string) => void;
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
  return (
    <div className="catalog-toolbar">
      <div className={`search-control${searchQuery ? " search-active" : ""}`}>
        <Search size={16} className="search-icon" />
        <input
          type="text"
          placeholder="Search items..."
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          aria-label="Search catalog"
        />
        {searchQuery && (
          <button
            type="button"
            className="search-clear"
            aria-label="Clear search"
            onClick={() => onSearchChange("")}
          >
            <X size={14} />
          </button>
        )}
      </div>
      <label className="sort-control">
        <ArrowDownUp size={15} />
        <SelectInput value={sort} aria-label="Sort products" onChange={(event) => onSortChange(event.target.value)}>
          <option value="recommended">Recommended</option>
          <option value="price-asc">Price ↑</option>
          <option value="price-desc">Price ↓</option>
          <option value="quantity">Most stock</option>
          <option value="name">Name</option>
        </SelectInput>
      </label>
      <div className="view-toggle" aria-label="View mode">
        <button
          type="button"
          className={viewMode === "grid" ? "active" : ""}
          aria-label="Grid view"
          onClick={() => onViewModeChange("grid")}
        >
          <Grid2X2 size={16} />
        </button>
        <button
          type="button"
          className={viewMode === "list" ? "active" : ""}
          aria-label="List view"
          onClick={() => onViewModeChange("list")}
        >
          <List size={16} />
        </button>
      </div>
    </div>
  );
}

