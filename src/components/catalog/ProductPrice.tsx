import { formatVnd } from "../../lib/format";
import { useCatalogCopy } from "../../lib/catalogI18n";
import { getProductDiscountPercent, getProductPrice, isProductOnSale } from "../../lib/pricing";
import type { Product } from "../../types/catalog";

export function ProductPrice({ product, className = "" }: { product: Product; className?: string }) {
  const copy = useCatalogCopy();
  const onSale = isProductOnSale(product);
  const effectivePrice = getProductPrice(product);

  return (
    <span
      className={`product-price ${onSale ? "is-sale" : ""} ${className}`.trim()}
      aria-label={onSale ? `${copy.sale}: ${formatVnd(effectivePrice)}, ${copy.price}: ${formatVnd(product.price_vnd)}` : formatVnd(effectivePrice)}
    >
      <strong className="product-price-current">{formatVnd(effectivePrice)}</strong>
      {onSale && <span className="product-price-comparison"><del>{formatVnd(product.price_vnd)}</del><em>-{getProductDiscountPercent(product)}%</em></span>}
    </span>
  );
}
