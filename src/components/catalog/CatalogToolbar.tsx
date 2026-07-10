import { ArrowDownUp, Check, ChevronDown, Grid2X2, List, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useCatalogCopy } from "../../lib/catalogI18n";

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
  const copy = useCatalogCopy();
  const sortOptions = [
    { value: "recommended", label: copy.recommended },
    { value: "price-asc", label: copy.priceLow },
    { value: "price-desc", label: copy.priceHigh },
    { value: "quantity", label: copy.mostStock },
    { value: "name", label: copy.name },
  ];
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = sortOptions.find((opt) => opt.value === sort) || sortOptions[0];

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

      <div className="sort-control-dropdown-wrapper" ref={dropdownRef}>
        <button
          type="button"
          className={`sort-control-trigger ${isOpen ? "open" : ""}`}
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Sort products dropdown"
        >
          <ArrowDownUp size={15} />
          <span>{selectedOption.label}</span>
          <ChevronDown size={13} className={`sort-chevron ${isOpen ? "open" : ""}`} />
        </button>

        {isOpen && (
          <ul className="sort-dropdown-menu">
            {sortOptions.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  className={`sort-dropdown-item ${opt.value === sort ? "active" : ""}`}
                  onClick={() => {
                    onSortChange(opt.value);
                    setIsOpen(false);
                  }}
                >
                  <span>{opt.label}</span>
                  {opt.value === sort && <Check size={13} className="check-icon" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="view-toggle" aria-label="View mode">
        <button
          type="button"
          className={viewMode === "grid" ? "active" : ""}
          aria-label={copy.gridView}
          onClick={() => onViewModeChange("grid")}
        >
          <Grid2X2 size={16} />
        </button>
        <button
          type="button"
          className={viewMode === "list" ? "active" : ""}
          aria-label={copy.listView}
          onClick={() => onViewModeChange("list")}
        >
          <List size={16} />
        </button>
      </div>
    </div>
  );
}
