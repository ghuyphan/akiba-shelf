import { useEffect, useMemo, useState } from "react";
import { Banknote, CheckCircle2, ReceiptText, Sparkles } from "lucide-react";
import type { CartItem, PaymentSettings, Product } from "../../types/catalog";
import { formatVnd } from "../../lib/format";
import { canGenerateVietQr, generateVietQrForCart } from "../../lib/vietqr";
import { Modal } from "../ui/Modal";
import { saveProduct } from "../../lib/api";
import { supabase } from "../../lib/supabase";

type PaymentQrModalProps = {
  isOpen: boolean;
  payment: PaymentSettings;
  cart: CartItem[];
  onClose: () => void;
  onSuccess: () => void;
};

export function PaymentQrModal({ isOpen, payment, cart, onClose, onSuccess }: PaymentQrModalProps) {
  const [qrSrc, setQrSrc] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);

  const totalAmount = useMemo(
    () => cart.reduce((sum, item) => sum + item.product.price_vnd * item.quantity, 0),
    [cart],
  );

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function loadQr() {
      setIsGenerating(true);
      const generated = await generateVietQrForCart(payment, cart).catch(() => null);
      if (!cancelled) {
        setQrSrc(generated?.src || payment.bank_qr_url || payment.momo_qr_url);
        setIsGenerating(false);
      }
    }

    void loadQr();
    return () => {
      cancelled = true;
    };
  }, [isOpen, payment, cart]);

  useEffect(() => {
    if (!supabase) return undefined;

    supabase.auth.getSession().then(({ data }) => {
      setIsStaff(Boolean(data.session));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsStaff(Boolean(session));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleConfirm = async () => {
    if (cart.length === 0) return;
    setIsConfirming(true);
    try {
      await Promise.all(
        cart.map((item) => {
          const newQty = Math.max(0, item.product.quantity_available - item.quantity);
          const newStatus = newQty === 0 ? "sold_out" : newQty <= 5 ? "limited" : "in_stock";
          const updatedProduct: Product = {
            ...item.product,
            quantity_available: newQty,
            stock_status: newStatus,
            stock_note: newQty === 0 ? "Sold out" : newQty <= 5 ? "Limited stock" : "In stock",
          };
          return saveProduct(updatedProduct);
        })
      );
      alert("Payment confirmed! Stock updated successfully.");
      onSuccess();
      onClose();
    } catch (err: any) {
      alert("Error confirming payment: " + (err.message || err));
    } finally {
      setIsConfirming(false);
    }
  };

  const handleLoginAndConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || cart.length === 0) return;
    setIsConfirming(true);
    setLoginError("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setIsStaff(true);
      setShowLoginForm(false);

      await Promise.all(
        cart.map((item) => {
          const newQty = Math.max(0, item.product.quantity_available - item.quantity);
          const newStatus = newQty === 0 ? "sold_out" : newQty <= 5 ? "limited" : "in_stock";
          const updatedProduct: Product = {
            ...item.product,
            quantity_available: newQty,
            stock_status: newStatus,
            stock_note: newQty === 0 ? "Sold out" : newQty <= 5 ? "Limited stock" : "In stock",
          };
          return saveProduct(updatedProduct);
        })
      );
      alert("Payment confirmed! Stock updated successfully.");
      onSuccess();
      onClose();
    } catch (err: any) {
      setLoginError(err.message || "Invalid credentials");
    } finally {
      setIsConfirming(false);
    }
  };

  const title = canGenerateVietQr(payment) ? payment.bank_label : payment.momo_label;

  return (
    <Modal title={title} isOpen={isOpen} onClose={onClose} className="payment-modal">
      <div className="qr-modal-layout">
        <div className="qr-display">
          {qrSrc && !isGenerating ? <img src={qrSrc} alt="Payment QR code" /> : <div className="qr-loading" />}
        </div>
        <div className="payment-receipt">
          <div className="receipt-header">
            <div className="receipt-success-icon">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <h3>Thank you!</h3>
              <p>Scan the QR code to complete transfer</p>
            </div>
          </div>

          <div className="receipt-divider" />

          {cart.length > 0 && (
            <div className="receipt-section">
              <span className="receipt-label">Order Details</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {cart.map((item) => (
                  <div key={item.product.id} className="receipt-row">
                    <span className="receipt-item-name">
                      {item.quantity} x {item.product.name}
                    </span>
                    <span className="receipt-item-price">{formatVnd(item.product.price_vnd * item.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="receipt-divider" />

          <div className="receipt-section">
            <span className="receipt-label">Transfer Details</span>
            <div className="receipt-details-list">
              <div className="receipt-detail-row">
                <span>Account Name</span>
                <strong>{payment.bank_account_name || "N/A"}</strong>
              </div>
              <div className="receipt-detail-row">
                <span>Account Number</span>
                <strong
                  style={{ cursor: "pointer" }}
                  title="Click to copy account number"
                  onClick={() => {
                    void navigator.clipboard.writeText(payment.bank_account_no || "");
                  }}
                >
                  {payment.bank_account_no || "N/A"}
                </strong>
              </div>
              <div className="receipt-detail-row">
                <span>Bank Name</span>
                <strong>{title}</strong>
              </div>
            </div>
          </div>

          {payment.payment_instructions && (
            <>
              <div className="receipt-divider" />
              <div className="receipt-instructions">
                <Sparkles size={14} />
                <span>{payment.payment_instructions}</span>
              </div>
            </>
          )}

          <div className="receipt-divider" />

          {isStaff ? (
            <button
              type="button"
              className="button button-primary"
              style={{ width: "100%", minHeight: "40px", height: "40px" }}
              disabled={isConfirming}
              onClick={handleConfirm}
            >
              {isConfirming ? "Confirming..." : "Confirm Payment & Update Stock"}
            </button>
          ) : showLoginForm ? (
            <form onSubmit={handleLoginAndConfirm} className="stack" style={{ display: "grid", gap: "8px" }}>
              <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--muted)", textTransform: "uppercase" }}>Staff Verification</div>
              <input
                type="email"
                placeholder="Staff Email"
                className="input"
                style={{ minHeight: "36px", height: "36px", padding: "0 10px", fontSize: "13px" }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Password"
                className="input"
                style={{ minHeight: "36px", height: "36px", padding: "0 10px", fontSize: "13px" }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {loginError && <div style={{ color: "var(--red)", fontSize: "12px" }}>{loginError}</div>}
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="submit"
                  className="button button-primary"
                  style={{ flex: 1, minHeight: "36px", height: "36px" }}
                  disabled={isConfirming}
                >
                  {isConfirming ? "Verifying..." : "Confirm"}
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  style={{ flex: 1, minHeight: "36px", height: "36px" }}
                  onClick={() => setShowLoginForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              className="button button-ghost"
              style={{
                width: "100%",
                fontSize: "12px",
                color: "var(--muted)",
                textDecoration: "underline",
                cursor: "pointer",
                padding: "4px"
              }}
              onClick={() => setShowLoginForm(true)}
            >
              Staff: Confirm Payment
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
