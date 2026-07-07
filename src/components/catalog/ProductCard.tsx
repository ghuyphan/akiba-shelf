import type { Product } from "../../types/catalog";
import { formatVnd } from "../../lib/format";
import { getStockTone } from "../../lib/product";

type ProductCardProps = {
  product: Product;
  selected: boolean;
  viewMode: "grid" | "list";
  onSelect: (product: Product) => void;
};

export function ProductCard({ product, selected, viewMode, onSelect }: ProductCardProps) {
  const primaryImage = product.images.find(Boolean);

  return (
    <button
      type="button"
      className={`product-card ${selected ? "product-card-selected" : ""} ${viewMode === "list" ? "product-card-list" : ""}`}
      onClick={() => onSelect(product)}
    >
      <div className="product-image-wrap">
        {product.badge && <span className="product-badge">{product.badge}</span>}
        {primaryImage ? (
          <img src={primaryImage} alt={product.name} loading="lazy" />
        ) : (
          <div className="product-image-placeholder" aria-hidden="true" />
        )}
      </div>
      <div className="product-card-body">
        <div>
          <h3>{product.name}</h3>
          {product.collection && <p className="product-collection">{product.collection}</p>}
          {product.description && (
            <p className="product-card-description" title={product.description}>
              {product.description}
            </p>
          )}
        </div>
        <div className="product-meta-row">
          <div>
            <strong>{formatVnd(product.price_vnd)}</strong>
            <span className={`stock-line ${getStockTone(product)}`}>
              {product.quantity_available > 50 ? "50+" : product.quantity_available} available
            </span>
          </div>
          <span className="item-code">
            {product.item_code}
          </span>
        </div>
      </div>
    </button>
  );
}
