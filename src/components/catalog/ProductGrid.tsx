import type { Product } from "../../types/catalog";
import { EmptyState } from "../ui/EmptyState";
import { ProductCard } from "./ProductCard";

type ProductGridProps = {
  products: Product[];
  selectedProduct?: Product;
  viewMode: "grid" | "list";
  onSelect: (product: Product) => void;
};

export function ProductGrid({ products, selectedProduct, viewMode, onSelect }: ProductGridProps) {
  if (products.length === 0) {
    return <EmptyState title="No merch found" message="Try another category or ask staff about restocks." />;
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
