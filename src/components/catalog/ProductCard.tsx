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
  const isSoldOut = product.quantity_available <= 0;

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(product);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={`product-card ${selected ? "product-card-selected" : ""} ${viewMode === "list" ? "product-card-list" : ""} ${isSoldOut ? "product-card-soldout" : ""}`}
      onClick={() => onSelect(product)}
      onKeyDown={handleKeyDown}
    >
      <div className="product-image-wrap">
        {product.badge ? (
          <span className="product-badge">{product.badge}</span>
        ) : product.featured ? (
          <span className="product-badge product-badge-featured">★ Featured</span>
        ) : null}
        {isSoldOut && (
          <div className="product-soldout-overlay">
            <span>Sold Out</span>
          </div>
        )}
        {primaryImage ? (
          <img src={primaryImage} alt={product.name} loading="lazy" />
        ) : (
          <div className="product-image-placeholder" aria-hidden="true" />
        )}
      </div>
      <div className="product-card-body">
        <div>
          <h3>
            {product.featured && <span style={{ color: "var(--mustard)", marginRight: "4px" }} title="Featured Item">★</span>}
            {product.name}
          </h3>
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
    </div>
  );
}
