import { ArrowDownUp, Grid2X2, List } from "lucide-react";
import { SelectInput } from "../ui/Field";

type CatalogToolbarProps = {
  sort: string;
  viewMode: "grid" | "list";
  onSortChange: (sort: string) => void;
  onViewModeChange: (mode: "grid" | "list") => void;
};

export function CatalogToolbar({ sort, viewMode, onSortChange, onViewModeChange }: CatalogToolbarProps) {
  return (
    <div className="catalog-toolbar">
      <label className="sort-control">
        <ArrowDownUp size={18} />
        <SelectInput value={sort} aria-label="Sort products" onChange={(event) => onSortChange(event.target.value)}>
          <option value="recommended">Recommended</option>
          <option value="price-asc">Price: Low to high</option>
          <option value="price-desc">Price: High to low</option>
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
          <Grid2X2 size={20} />
        </button>
        <button
          type="button"
          className={viewMode === "list" ? "active" : ""}
          aria-label="List view"
          onClick={() => onViewModeChange("list")}
        >
          <List size={20} />
        </button>
      </div>
    </div>
  );
}
