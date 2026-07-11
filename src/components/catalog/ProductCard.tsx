import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import type { Product } from "../../types/catalog";
import { formatVnd } from "../../lib/format";
import { getStockTone } from "../../lib/product";
import { useCatalogCopy } from "../../lib/catalogI18n";

type ProductCardProps = {
  product: Product;
  selected: boolean;
  viewMode: "grid" | "list";
  onSelect: (product: Product, event?: React.MouseEvent) => void;
  onViewDetails: (product: Product) => void;
  style?: React.CSSProperties;
};

export function ProductCard({ product, selected, viewMode, onSelect, onViewDetails, style }: ProductCardProps) {
  const copy = useCatalogCopy();
  const images = product.images.filter(Boolean);
  const [activeImage, setActiveImage] = useState(0);
  const primaryImage = images[activeImage] || images[0];
  const isSoldOut = product.quantity_available <= 0;

  return (
    <div
      className={`product-card ${selected ? "product-card-selected" : ""} ${viewMode === "list" ? "product-card-list" : ""} ${isSoldOut ? "product-card-soldout" : ""}`}
      style={style}
      role="button"
      tabIndex={0}
      aria-label={copy.viewDetails(product.name)}
      onClick={(event) => { event.stopPropagation(); onViewDetails(product); }}
      onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) { event.preventDefault(); onViewDetails(product); } }}
    >
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
          <img src={primaryImage} alt={product.name} loading="lazy" />
        ) : (
          <div className="product-image-placeholder" aria-hidden="true" />
        )}
        {images.length > 1 && <div className="product-image-thumbs" aria-label={`${product.name} images`}>{images.slice(0, 4).map((image, index) => <button key={`${image}-${index}`} type="button" className={index === activeImage ? "active" : ""} onClick={(event) => { event.stopPropagation(); setActiveImage(index); }} aria-label={`Show image ${index + 1}`}><img src={image} alt="" /></button>)}</div>}
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
            <strong>{formatVnd(product.price_vnd)}</strong>
            <span className={`stock-line ${getStockTone(product)}`}>{isSoldOut ? copy.soldOut : copy.available(product.quantity_available > 50 ? 50 : product.quantity_available).replace("50 available", product.quantity_available > 50 ? "50+ available" : "50 available").replace("Còn 50 sản phẩm", product.quantity_available > 50 ? "Còn 50+ sản phẩm" : "Còn 50 sản phẩm")}</span>
          </div>
          <div className="product-card-actions"><span className="item-code">{product.item_code}</span><button type="button" className="product-add-button" disabled={isSoldOut} onClick={(event) => { event.stopPropagation(); onSelect(product, event); }} aria-label={isSoldOut ? copy.productSoldOut(product.name) : copy.addProduct(product.name)} title={isSoldOut ? copy.soldOut : copy.addToCart}><ShoppingCart size={16} /><span>{isSoldOut ? copy.unavailable : copy.addToCart}</span></button></div>
        </div>
      </div>
    </div>
  );
}
