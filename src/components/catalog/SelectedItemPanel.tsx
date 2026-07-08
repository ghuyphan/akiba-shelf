import { Banknote, ShoppingBag, Minus, Plus, Trash2 } from "lucide-react";
import type { CartItem } from "../../types/catalog";
import { formatVnd } from "../../lib/format";
import { Button } from "../ui/Button";

type SelectedItemPanelProps = {
  cart: CartItem[];
  onQuantityChange: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  onOpenPayment: () => void;
  onClearCart: () => void;
};

export function SelectedItemPanel({ cart, onQuantityChange, onRemove, onOpenPayment, onClearCart }: SelectedItemPanelProps) {
  if (cart.length === 0) {
    return (
      <aside className="selected-panel selected-panel-empty">
        <div className="selected-empty-centered">
          <ShoppingBag size={48} className="empty-icon" />
          <h3>Your cart is empty</h3>
          <p>Tap merch cards to add items to the cart.</p>
        </div>
      </aside>
    );
  }

  const totalAmount = cart.reduce((sum, item) => sum + item.product.price_vnd * item.quantity, 0);

  return (
    <aside className="selected-panel">
      <div className="selected-header">
        <h2>Cart</h2>
        <Button variant="ghost" className="clear-button" onClick={onClearCart}>
          Clear All
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
                <strong className="cart-item-price">{formatVnd(item.product.price_vnd)}</strong>
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

      <div className="selected-actions" style={{ marginTop: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", padding: "0 4px" }}>
          <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--muted)" }}>Total Price</span>
          <strong style={{ fontSize: "16px", fontWeight: "800", color: "var(--ink)" }}>{formatVnd(totalAmount)}</strong>
        </div>
        <Button variant="primary" className="button-checkout" icon={<Banknote size={18} />} onClick={onOpenPayment}>
          <span className="checkout-btn-label">Pay Now</span>
          <span className="checkout-btn-price">{formatVnd(totalAmount)}</span>
        </Button>
      </div>
    </aside>
  );
}
