import { PackageSearch, RotateCcw, Tags } from "lucide-react";
import type { Product } from "../../types/catalog";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { ProductCard } from "./ProductCard";
import { useCatalogCopy } from "../../lib/catalogI18n";

type ProductGridProps = {
  products: Product[];
  totalProducts: number;
  activeCategory: string;
  selectedProduct?: Product;
  viewMode: "grid" | "list";
  onSelect: (product: Product, event?: React.MouseEvent) => void;
  onViewDetails: (product: Product) => void;
  onResetFilters: () => void;
};

export function ProductGrid({ products, totalProducts, activeCategory, selectedProduct, viewMode, onSelect, onViewDetails, onResetFilters }: ProductGridProps) {
  const copy = useCatalogCopy();
  if (products.length === 0) {
    const hasInventory = totalProducts > 0;

    return (
      <EmptyState
        icon={hasInventory ? <Tags size={28} /> : <PackageSearch size={28} />}
        title={hasInventory ? copy.nothingCategory : copy.noMerch}
        message={hasInventory ? copy.switchCatalog : copy.addInAdmin}
        meta={[hasInventory ? (activeCategory === "All" ? copy.all : activeCategory) : copy.catalogEmpty, viewMode === "grid" ? copy.gridView : copy.listView]}
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
    <div className={`product-grid ${viewMode === "list" ? "product-grid-list" : ""}`}>
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          selected={product.id === selectedProduct?.id}
          viewMode={viewMode}
          onSelect={onSelect}
          onViewDetails={onViewDetails}
          style={{ animationDelay: `${Math.min(index * 45, 600)}ms` }}
        />
      ))}
    </div>
  );
}
