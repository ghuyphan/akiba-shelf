import { memo } from "react";
import { ShoppingCart } from "lucide-react";
import type { Product } from "../../types/catalog";
import { getStockTone } from "../../lib/product";
import { useCatalogCopy } from "../../lib/catalogI18n";
import { ProductPrice } from "./ProductPrice";

type ProductCardProps = {
  product: Product;
  selected: boolean;
  viewMode: "grid" | "list";
  onSelect: (product: Product, event?: React.MouseEvent) => void;
  onViewDetails: (product: Product) => void;
};

// The card reads as one large click target, but structurally it is a plain
// container with a full-cover details button underneath the add-to-cart
// button, so the two actions never nest interactive elements.
export const ProductCard = memo(function ProductCard({ product, selected, viewMode, onSelect, onViewDetails }: ProductCardProps) {
  const copy = useCatalogCopy();
  const images = product.images.filter(Boolean);
  const primaryImage = product.image_variants?.[0]?.thumbnail || images[0];
  const isSoldOut = product.quantity_available <= 0;

  return (
    <div
      className={`product-card ${selected ? "product-card-selected" : ""} ${viewMode === "list" ? "product-card-list" : ""} ${isSoldOut ? "product-card-soldout" : ""}`}
      style={{ position: "relative" }}
    >
      <button
        type="button"
        className="product-card-hit"
        aria-label={copy.viewDetails(product.name)}
        onClick={(event) => { event.stopPropagation(); onViewDetails(product); }}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 3,
          width: "100%",
          height: "100%",
          padding: 0,
          border: "none",
          background: "none",
          borderRadius: "inherit",
          cursor: "pointer",
        }}
      />
      <div className="product-image-wrap">
        {product.badge ? (
          <span className="product-badge" style={{ backgroundColor: product.badge_color || undefined }}>{product.badge}</span>
        ) : product.featured ? (
          <span className="product-badge product-badge-featured">★ {copy.featured}</span>
        ) : null}
        {isSoldOut && (
          <div className="product-soldout-overlay">
            <span>{copy.soldOut}</span>
          </div>
        )}
        {primaryImage ? (
          <img src={primaryImage} alt={product.name} loading="lazy" decoding="async" width="600" height="600" />
        ) : (
          <div className="product-image-placeholder" aria-hidden="true" />
        )}
      </div>
      <div className="product-card-body">
        <div>
          <div className="product-card-taxonomy"><span>{product.collection || product.category}</span>{product.featured && <span>{copy.featured}</span>}</div>
          <h3>{product.name}</h3>
          {product.description && (
            <p className="product-card-description" title={product.description}>
              {product.description}
            </p>
          )}
        </div>
        <div className="product-meta-row">
          <div>
            <ProductPrice product={product} />
            <span className={`stock-line ${getStockTone(product)}`}>{isSoldOut ? copy.soldOut : product.quantity_available > 50 ? copy.availableCapped(50) : copy.available(product.quantity_available)}</span>
          </div>
          <div className="product-card-actions" style={{ position: "relative", zIndex: 4 }}><span className="item-code">{product.item_code}</span><button type="button" className="product-add-button" disabled={isSoldOut} onClick={(event) => { event.stopPropagation(); onSelect(product, event); }} aria-label={isSoldOut ? copy.productSoldOut(product.name) : copy.addProduct(product.name)} title={isSoldOut ? copy.soldOut : copy.addToCart}><ShoppingCart size={16} /><span>{isSoldOut ? copy.unavailable : copy.addToCart}</span></button></div>
        </div>
      </div>
    </div>
  );
});
