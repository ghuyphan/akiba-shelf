import { Banknote, ShoppingBag, Minus, Plus, Trash2 } from "lucide-react";
import type { CartItem } from "../../types/catalog";
import { formatVnd } from "../../lib/format";
import { getProductPrice } from "../../lib/pricing";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { useCatalogCopy } from "../../lib/catalogI18n";
import { MobileSheetShell, SheetHandle } from "../ui/MobileSheetShell";
import { useOverlayHistory } from "../../hooks/useOverlayHistory";

type SelectedItemPanelProps = {
  cart: CartItem[];
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

  const totalAmount = cart.reduce((sum, item) => sum + getProductPrice(item.product) * item.quantity, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <MobileSheetShell
      open={isExpanded}
      onDismiss={requestCollapse}
      mode="expandable"
      className={`selected-panel ${isExpanded ? "mobile-expanded" : "mobile-collapsed"}`}
    >
      <div className="mobile-drag-handle">
        <SheetHandle onClick={requestCollapse} label="Collapse cart" />
      </div>

      {/* Mobile collapsed summary bar (only visible on mobile collapsed state) */}
      <div
        className="mobile-cart-summary-bar"
        onClick={onToggleExpand}
      >
        <div className="mobile-cart-summary-info">
          <div className="mobile-cart-summary-icon-wrap">
            <ShoppingBag size={20} />
            <span className="mobile-cart-count-badge">{totalItems}</span>
          </div>
          <div className="mobile-cart-summary-text">
            <strong>{copy.cart}</strong>
            <span>{formatVnd(totalAmount)}</span>
          </div>
        </div>
        <Button
          variant="primary"
          className="mobile-cart-summary-btn"
          onClick={(e) => {
            e.stopPropagation();
            if (onToggleExpand) onToggleExpand();
          }}
        >
          {copy.viewCart}
        </Button>
      </div>

      {/* Full cart content */}
      <div className="cart-full-content">
        <div className="selected-header">
          <h2>{copy.cart} ({totalItems})</h2>
          <Button variant="ghost" className="clear-button" onClick={onClearCart}>
            {copy.clearAll}
          </Button>
        </div>

        <div className="cart-items-container">
          {cart.map((item) => {
            const primaryImage = item.product.images.find(Boolean);
            const maxQuantity = Math.max(1, item.product.quantity_available);
            const canDecrease = item.quantity > 1;
            const canIncrease = item.quantity < maxQuantity;

            return (
              <div key={item.product.id} className="cart-item-row">
                {primaryImage ? (
                  <img className="cart-item-thumb" src={primaryImage} alt={item.product.name} />
                ) : (
                  <div className="cart-item-thumb cart-item-placeholder" aria-hidden="true" />
                )}
                <div className="cart-item-details">
                  <h4>{item.product.name}</h4>
                  <span className="cart-item-code">{item.product.item_code}</span>
                  <strong className="cart-item-price">{formatVnd(getProductPrice(item.product))}</strong>
                </div>
                <div className="cart-item-actions">
                  <div className="cart-quantity-stepper">
                    <button
                      type="button"
                      disabled={!canDecrease}
                      onClick={() => onQuantityChange(item.product.id, item.quantity - 1)}
                    >
                      <Minus size={12} />
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
                      disabled={!canIncrease}
                      onClick={() => onQuantityChange(item.product.id, item.quantity + 1)}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <button
                    className="cart-item-remove"
                    type="button"
                    aria-label="Remove item"
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
          <div className="cart-total-row">
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
