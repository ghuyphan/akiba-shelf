import { PackageSearch, RotateCcw, Tags } from "lucide-react";
import type { Product } from "../../types/catalog";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { ProductCard } from "./ProductCard";

type ProductGridProps = {
  products: Product[];
  totalProducts: number;
  activeCategory: string;
  selectedProduct?: Product;
  viewMode: "grid" | "list";
  onSelect: (product: Product) => void;
  onResetFilters: () => void;
};

export function ProductGrid({ products, totalProducts, activeCategory, selectedProduct, viewMode, onSelect, onResetFilters }: ProductGridProps) {
  if (products.length === 0) {
    const hasInventory = totalProducts > 0;

    return (
      <EmptyState
        icon={hasInventory ? <Tags size={28} /> : <PackageSearch size={28} />}
        title={hasInventory ? "Nothing in this category" : "No merch is live yet"}
        message={hasInventory ? "Switch back to the full catalog to keep the line moving." : "Add active products in admin before opening the booth catalog."}
        meta={[hasInventory ? activeCategory : "Catalog empty", viewMode === "grid" ? "Grid view" : "List view"]}
        action={
          hasInventory ? (
            <Button type="button" variant="secondary" icon={<RotateCcw size={18} />} onClick={onResetFilters}>
              Show All Items
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className={`product-grid ${viewMode === "list" ? "product-grid-list" : ""}`}>
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          selected={product.id === selectedProduct?.id}
          viewMode={viewMode}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
