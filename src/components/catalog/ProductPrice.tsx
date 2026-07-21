import { formatVnd } from "../../utils/format";
import { useCatalogCopy } from "../../lib/i18n/catalogI18n";
import { getProductDiscountPercent, getProductPrice, isProductOnSale } from "../../utils/pricing";
import type { Product } from "../../types/catalog";
import { usePromotion } from "../../lib/promotionContext";

export function ProductPrice({ product, className = "" }: { product: Product; className?: string }) {
  const copy = useCatalogCopy();
  const promotion = usePromotion();
  const onSale = isProductOnSale(product);
  const effectivePrice = getProductPrice(product);
  const isQualifyingProduct = promotion.enabled && promotion.qualifying_product_ids.includes(product.id);
  const isRewardProduct = promotion.enabled && promotion.reward_product_ids.includes(product.id);
  const promotionLabel = isQualifyingProduct && isRewardProduct
    ? copy.combinedPromotion(promotion.buy_quantity, promotion.free_quantity)
    : isRewardProduct
      ? copy.rewardPromotion
      : isQualifyingProduct
        ? copy.qualifyingPromotion(promotion.buy_quantity)
        : "";

  return (
    <span
      className={`product-price ${onSale ? "is-sale" : ""} ${className}`.trim()}
      aria-label={onSale ? `${copy.sale}: ${formatVnd(effectivePrice)}, ${copy.price}: ${formatVnd(product.price_vnd)}` : formatVnd(effectivePrice)}
    >
      <strong className="product-price-current">{formatVnd(effectivePrice)}</strong>
      {onSale && <span className="product-price-comparison"><del>{formatVnd(product.price_vnd)}</del><em>-{getProductDiscountPercent(product)}%</em></span>}
      {promotionLabel && <span className={`product-promotion-label ${isQualifyingProduct && isRewardProduct ? "is-combined" : isRewardProduct ? "is-reward" : "is-qualifying"}`}>{promotionLabel}</span>}
    </span>
  );
}
