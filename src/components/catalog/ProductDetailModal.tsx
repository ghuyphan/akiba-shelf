import { useEffect, useState } from "react";
import { PackageCheck, ShoppingCart, Tag } from "lucide-react";
import type { Product } from "../../types/catalog";
import { Modal } from "../ui/Modal";
import { useCatalogCopy } from "../../lib/i18n/catalogI18n";
import { ProductPrice } from "./ProductPrice";

type ProductDetailModalProps = {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product, event?: React.MouseEvent) => void;
};

export function ProductDetailModal({ product, onClose, onAddToCart }: ProductDetailModalProps) {
  const copy = useCatalogCopy();
  const [activeImage, setActiveImage] = useState(0);
  const [displayedProduct, setDisplayedProduct] = useState(product);

  useEffect(() => {
    if (!product) return;
    setDisplayedProduct(product);
    setActiveImage(0);
  }, [product]);
  if (!displayedProduct) return null;

  const variants = displayedProduct.image_variants ?? [];
  const fallbackImages = displayedProduct.images.filter(Boolean);
  const detailImages = variants.length
    ? variants.map((variant) => variant.detail)
    : fallbackImages;
  const thumbnailImages = variants.length
    ? variants.map((variant) => variant.thumbnail)
    : fallbackImages;
  const image = detailImages[activeImage] || detailImages[0];
  const isSoldOut = displayedProduct.quantity_available <= 0 || displayedProduct.stock_status === "sold_out";

  return (
    <Modal title={copy.itemDetails} isOpen={Boolean(product)} onClose={onClose} className="product-detail-modal" mobileSheet>
      <div className="product-detail-layout">
        <div className="product-detail-gallery">
          <div className="product-detail-main-image">
            {image ? <img src={image} alt={displayedProduct.name} decoding="async" /> : <span className="product-image-placeholder" />}
            {displayedProduct.badge && <span className="product-detail-image-badge" style={{ backgroundColor: displayedProduct.badge_color || undefined }}>{displayedProduct.badge}</span>}
            {thumbnailImages.length > 1 && (
              <div className="product-detail-thumbnails" aria-label={copy.productImages}>
                {thumbnailImages.slice(0, 6).map((source, index) => (
                  <button
                    key={`${source}-${index}`}
                    type="button"
                    className={index === activeImage ? "active" : ""}
                    onClick={() => setActiveImage(index)}
                    aria-label={copy.showImage(index + 1)}
                    aria-pressed={index === activeImage}
                  >
                    <img src={source} alt="" loading="lazy" decoding="async" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="product-detail-copy">
          <div className="product-detail-taxonomy"><span><Tag size={13} /> {displayedProduct.collection || displayedProduct.category}</span>{displayedProduct.featured && <span>{copy.featuredItem}</span>}</div>
          <h2>{displayedProduct.name}</h2>
          <span className="product-detail-code">{copy.item} {displayedProduct.item_code}</span>
          <p>{displayedProduct.description || copy.noDescription}</p>
          <div className="product-detail-purchase">
            <div><small>{copy.price}</small><ProductPrice product={displayedProduct} /></div>
            <span className={isSoldOut ? "soldout" : displayedProduct.quantity_available <= 5 ? "limited" : "available"}><PackageCheck size={15} />{isSoldOut ? copy.soldOut : copy.available(displayedProduct.quantity_available)}</span>
          </div>
          <button type="button" className="product-detail-add" disabled={isSoldOut} onClick={(event) => { onAddToCart(displayedProduct, event); onClose(); }}><ShoppingCart size={18} />{isSoldOut ? copy.currentlyUnavailable : copy.addToCart}</button>
          <small className="product-detail-note">{copy.stockNote}</small>
        </div>
      </div>
    </Modal>
  );
}
