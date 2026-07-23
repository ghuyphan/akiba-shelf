import { Banknote, ShoppingBag, Minus, Plus, Trash2 } from "lucide-react";
import type { CartItem, Product, PromotionSettings } from "../../../types/catalog";
import { formatVnd } from "../../../utils/format";
import { calculateCartPricing, getPricingLine } from "../../../utils/pricing";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { useCatalogCopy } from "../../../lib/i18n/catalogI18n";
import { MobileSheetShell, SheetHandle } from "../../ui/MobileSheetShell";
import { useOverlayHistory } from "../../../hooks/shared/useOverlayHistory";

type SelectedItemPanelProps = {
  cart: CartItem[];
  promotion?: PromotionSettings;
  rewardProducts?: Product[];
  onAddReward?: (product: Product) => void;
  onQuantityChange: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  onOpenPayment: () => void;
  onClearCart: () => void;
  checkoutLabel?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
};

export function SelectedItemPanel({
  cart,
  promotion,
  rewardProducts = [],
  onAddReward,
  onQuantityChange,
  onRemove,
  onOpenPayment,
  onClearCart,
  checkoutLabel,
  isExpanded = false,
  onToggleExpand,
}: SelectedItemPanelProps) {
  const copy = useCatalogCopy();
  const requestCollapse = useOverlayHistory(isExpanded, () => onToggleExpand?.());
  if (cart.length === 0) {
    return (
      <aside className="selected-panel selected-panel-empty">
        <EmptyState variant="compact" icon={<ShoppingBag size={26} />} title={copy.emptyCart} message={copy.emptyCartHint} />
      </aside>
    );
  }

  const pricing = calculateCartPricing(cart, promotion);
  const totalAmount = pricing.total;
  const totalItems = pricing.lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <MobileSheetShell
      open={isExpanded}
      onDismiss={requestCollapse}
      mode="expandable"
      className={`selected-panel ${isExpanded ? "mobile-expanded" : "mobile-collapsed"}`}
      role={isExpanded ? "dialog" : undefined}
      ariaModal={isExpanded || undefined}
      ariaLabel={isExpanded ? copy.cart : undefined}
    >
      <div className="mobile-drag-handle">
        <SheetHandle onClick={requestCollapse} label={copy.collapseCart} />
      </div>

      {/* Mobile collapsed summary bar (only visible on mobile collapsed state) */}
      <button
        type="button"
        className="mobile-cart-summary-bar"
        aria-label={copy.viewCart}
        onClick={onToggleExpand}
        style={{
          padding: 0,
          border: "none",
          background: "none",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <span className="mobile-cart-summary-info">
          <span className="mobile-cart-summary-icon-wrap">
            <ShoppingBag size={20} />
            <span className="mobile-cart-count-badge">{totalItems}</span>
          </span>
          <span className="mobile-cart-summary-text">
            <strong>{copy.cart}</strong>
            <span>{formatVnd(totalAmount)}</span>
          </span>
        </span>
        <span className="button button-primary mobile-cart-summary-btn">
          <span>{copy.viewCart}</span>
        </span>
      </button>

      {/* Full cart content */}
      <div className="cart-full-content">
        <div className="selected-header">
          <div className="selected-header-copy">
            <h2>{copy.cart} ({totalItems})</h2>
            {cart.length > 4 && <span>{copy.scrollCartItems}</span>}
          </div>
          <Button variant="ghost" className="clear-button" onClick={onClearCart}>
            {copy.clearAll}
          </Button>
        </div>

        <div className="cart-items-container" role="list" aria-label={copy.cartItems} tabIndex={cart.length > 4 ? 0 : undefined}>
          {cart.map((item) => {
            const pricingLine = getPricingLine(pricing, item.product.id);
            // Cart state can briefly lag the pricing snapshot during
            // realtime reconciles; skip the row instead of crashing.
            if (!pricingLine) return null;
            const primaryImage = item.product.image_variants?.[0]?.thumbnail || item.product.images.find(Boolean);
            const maxQuantity = Math.max(1, item.product.quantity_available);
            const canDecrease = item.quantity > 0;
            const canIncrease = pricingLine.quantity < maxQuantity;

            return (
              <div key={item.product.id} className="cart-item-row" role="listitem">
                {primaryImage ? (
                  <img className="cart-item-thumb" src={primaryImage} alt={item.product.name} />
                ) : (
                  <div className="cart-item-thumb cart-item-placeholder" aria-hidden="true" />
                )}
                <div className="cart-item-details">
                  <h4>{item.product.name}</h4>
                  <span className="cart-item-code">{item.product.item_code}</span>
                  <strong className="cart-item-price">{pricingLine.quantity} × {formatVnd(pricingLine.unitPrice)}</strong>
                  {pricingLine.freeQuantity > 0 && <span className="cart-item-promotion">{copy.freeItems(pricingLine.freeQuantity)} · −{formatVnd(pricingLine.discountAmount)}</span>}
                </div>
                <div className="cart-item-actions">
                  <div className="cart-quantity-stepper">
                    <button
                      type="button"
                      disabled={!canDecrease}
                      aria-label={copy.decreaseQuantity(item.product.name)}
                      onClick={() => onQuantityChange(item.product.id, item.quantity - 1)}
                    >
                      <Minus size={12} />
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
                      disabled={!canIncrease}
                      aria-label={copy.increaseQuantity(item.product.name)}
                      onClick={() => onQuantityChange(item.product.id, item.quantity + 1)}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <button
                    className="cart-item-remove"
                    type="button"
                    aria-label={copy.removeItem(item.product.name)}
                    onClick={() => onRemove(item.product.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="selected-actions cart-total-actions">
          {pricing.availableRewardQuantity > 0 && rewardProducts.length > 0 && <div className="cart-reward-picker"><strong>{copy.chooseFreeItem}</strong><span>{copy.freeRewardsAvailable(pricing.availableRewardQuantity)}</span><div>{rewardProducts.map((product) => { const inCart = cart.find((item) => item.product.id === product.id); const unavailable = !product.active || product.quantity_available <= (inCart?.quantity ?? 0) + (inCart?.reward_quantity ?? 0); const rewardImage = product.image_variants?.[0]?.thumbnail || product.images.find(Boolean); return <button type="button" key={product.id} disabled={unavailable} onClick={() => onAddReward?.(product)}>{rewardImage ? <img src={rewardImage} alt="" /> : <i /> }<span>{product.name}<small>{unavailable ? copy.soldOut : copy.addFreeItem}</small></span></button>; })}</div></div>}
          {promotion?.enabled && pricing.eligibleQuantity > 0 && (
            <div className={`cart-promotion-summary ${pricing.discountAmount > 0 ? "is-applied" : ""}`}>
              <strong>{copy.buyXGetY(promotion.buy_quantity, promotion.free_quantity)}</strong>
              <span>{pricing.discountAmount > 0 ? copy.promotionApplied(formatVnd(pricing.discountAmount)) : copy.promotionProgress(pricing.unitsUntilNextFreeItem)}</span>
            </div>
          )}
          {pricing.discountAmount > 0 && <div className="cart-discount-row"><span>{copy.discount}</span><strong>−{formatVnd(pricing.discountAmount)}</strong></div>}
          <div className="cart-total-row" aria-live="polite">
            <span>{copy.totalPrice}</span>
            <strong>{formatVnd(totalAmount)}</strong>
          </div>
          <Button variant="primary" className="button-checkout" icon={<Banknote size={18} />} onClick={onOpenPayment}>
            <span className="checkout-btn-label">{checkoutLabel ?? copy.payNow}</span>
            <span className="checkout-btn-price">{formatVnd(totalAmount)}</span>
          </Button>
        </div>
      </div>
    </MobileSheetShell>
  );
}
