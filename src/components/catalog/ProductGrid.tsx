import { AlertTriangle, ChevronDown, LoaderCircle, PackageSearch, RotateCcw, Tags } from "lucide-react";
import type { Product } from "../../types/catalog";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { ProductCard } from "./ProductCard";
import { useCatalogCopy } from "../../lib/i18n/catalogI18n";

type ProductGridProps = {
  products: Product[];
  totalProducts: number;
  activeCategory: string;
  selectedProduct?: Product;
  viewMode: "grid" | "list";
  onSelect: (product: Product, event?: React.MouseEvent) => void;
  onViewDetails: (product: Product) => void;
  onResetFilters: () => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  searchActive?: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  emptyMessage?: string;
};

export function ProductGrid({ products, totalProducts, activeCategory, selectedProduct, viewMode, onSelect, onViewDetails, onResetFilters, loading = false, error, onRetry, searchActive = false, hasMore = false, loadingMore = false, onLoadMore, emptyMessage }: ProductGridProps) {
  const copy = useCatalogCopy();
  if (loading && totalProducts === 0) return <EmptyState tone="loading" icon={<LoaderCircle className="state-spinner" size={28} />} title={copy.loadingCatalog} message={copy.loadingCatalogHint} />;
  if (error && totalProducts === 0) return <EmptyState tone="error" icon={<AlertTriangle size={28} />} title={copy.catalogUnavailable} message={copy.catalogUnavailableHint} action={onRetry ? <Button type="button" icon={<RotateCcw size={18} />} onClick={onRetry}>{copy.tryAgain}</Button> : undefined} />;
  if (products.length === 0) {
    const hasInventory =
      totalProducts > 0 || searchActive || activeCategory !== "All";

    return (
      <EmptyState
        icon={hasInventory ? <Tags size={28} /> : <PackageSearch size={28} />}
        title={hasInventory ? (searchActive ? copy.noSearchResults : copy.nothingCategory) : copy.noMerch}
        message={hasInventory ? (searchActive ? copy.noSearchResultsHint : copy.switchCatalog) : emptyMessage ?? copy.addInAdmin}
        meta={hasInventory ? [activeCategory === "All" ? copy.all : activeCategory, viewMode === "grid" ? copy.gridView : copy.listView] : []}
        action={
          hasInventory ? (
            <Button type="button" variant="secondary" icon={<RotateCcw size={18} />} onClick={onResetFilters}>
              {copy.showAll}
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="product-results" aria-busy={loading || loadingMore}>
      <div className={`product-grid ${viewMode === "list" ? "product-grid-list" : ""}`}>
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            selected={product.id === selectedProduct?.id}
            viewMode={viewMode}
            onSelect={onSelect}
            onViewDetails={onViewDetails}
          />
        ))}
      </div>
      {(hasMore || loadingMore) && onLoadMore ? (
        <div className="catalog-load-more">
          <span>{copy.itemsShown(products.length)}</span>
          <Button
            type="button"
            variant="secondary"
            icon={<ChevronDown size={18} />}
            loading={loadingMore}
            loadingText={copy.loadingMore}
            onClick={onLoadMore}
          >
            {copy.loadMore}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
