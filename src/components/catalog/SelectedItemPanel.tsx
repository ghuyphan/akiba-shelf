import { Banknote, Minus, Plus, Trash2, X } from "lucide-react";
import type { PaymentSettings, Product } from "../../types/catalog";
import { formatVnd } from "../../lib/format";
import { Button } from "../ui/Button";

type SelectedItemPanelProps = {
  product?: Product;
  payment: PaymentSettings;
  onOpenPayment: () => void;
  onClose: () => void;
};

export function SelectedItemPanel({ product, payment, onOpenPayment, onClose }: SelectedItemPanelProps) {
  if (!product) {
    return (
      <aside className="selected-panel selected-panel-empty">
        <div className="selected-header">
          <h2>Selected Item</h2>
        </div>
        <div className="selected-empty-body">
          <div className="selected-empty-thumb" />
          <div>
            <h3>No item selected</h3>
            <p>Tap a merch card to preview details and generate a payment QR.</p>
          </div>
        </div>
        <div className="selected-actions">
          <Button variant="secondary" icon={<Banknote size={18} />} disabled>
            {payment.bank_label}
          </Button>
        </div>
      </aside>
    );
  }

  const primaryImage = product.images.find(Boolean);

  return (
    <aside className="selected-panel">
      <div className="selected-header">
        <h2>Selected Item</h2>
        <button className="clear-button" type="button" onClick={onClose}>
          Clear
        </button>
        <Button variant="ghost" icon={<X size={22} />} aria-label="Close selected item" onClick={onClose} />
      </div>
      <div className="selected-cart-item">
        {primaryImage ? (
          <img className="selected-image" src={primaryImage} alt={product.name} />
        ) : (
          <div className="selected-image selected-image-placeholder" aria-hidden="true" />
        )}
        <div className="selected-copy">
          <h3>{product.name}</h3>
          <p>{product.collection}</p>
          <strong className="selected-price">{formatVnd(product.price_vnd)}</strong>
          <span className="large-code">{product.item_code}</span>
        </div>
      </div>
      <div className="quantity-row">
        <div className="quantity-stepper" aria-label="Quantity">
          <button type="button" aria-label="Decrease quantity">
            <Minus size={16} />
          </button>
          <span>1</span>
          <button type="button" aria-label="Increase quantity">
            <Plus size={16} />
          </button>
        </div>
        <button className="trash-button" type="button" aria-label="Remove selected item" onClick={onClose}>
          <Trash2 size={18} />
        </button>
      </div>
      <div className="selected-actions">
        <Button variant="secondary" icon={<Banknote size={18} />} onClick={onOpenPayment}>
          {payment.bank_label}
        </Button>
      </div>
    </aside>
  );
}
