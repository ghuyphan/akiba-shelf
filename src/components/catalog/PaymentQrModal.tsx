import { useEffect, useMemo, useState, useRef } from "react";
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
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setShowSuccess(false);
    }
  }, [isOpen]);

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
      setShowSuccess(true);
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
      setShowSuccess(true);
    } catch (err: any) {
      setLoginError(err.message || "Invalid credentials");
    } finally {
      setIsConfirming(false);
    }
  };

  const title = canGenerateVietQr(payment) ? payment.bank_label : payment.momo_label;

  const handleSuccessClose = () => {
    setShowSuccess(false);
    onSuccess();
    onClose();
  };

  if (showSuccess) {
    return (
      <Modal title="Success!" isOpen={isOpen} onClose={handleSuccessClose} className="payment-modal success-modal">
        <div className="payment-success-state" style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 20px",
          textAlign: "center",
          gap: "20px"
        }}>
          <div className="success-icon-wrap" style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: "color-mix(in srgb, var(--teal) 10%, transparent)",
            color: "var(--teal)",
            display: "grid",
            placeItems: "center",
            animation: "success-pop 500ms var(--ease-out)"
          }}>
            <CheckCircle2 size={48} style={{ animation: "success-rotate 600ms var(--ease-out)" }} />
          </div>
          <h2 style={{ fontSize: "22px", fontWeight: "800", color: "var(--ink)", margin: 0 }}>
            Payment Confirmed!
          </h2>
          <p style={{ fontSize: "14px", color: "var(--muted)", margin: 0, maxWidth: "280px" }}>
            The order is complete and stock levels have been updated. Thank you!
          </p>
          <button
            type="button"
            className="button button-primary"
            style={{ width: "100%", marginTop: "12px", minHeight: "44px", height: "44px" }}
            onClick={handleSuccessClose}
          >
            Close
          </button>
        </div>
      </Modal>
    );
  }

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
            <SwipeConfirmButton onConfirm={handleConfirm} isConfirming={isConfirming} />
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

type SwipeConfirmButtonProps = {
  onConfirm: () => void;
  isConfirming: boolean;
};

function SwipeConfirmButton({ onConfirm, isConfirming }: SwipeConfirmButtonProps) {
  const [dragOffset, setDragOffset] = useState(0);
  const [isSwiped, setIsSwiped] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);

  const handleStart = (clientX: number) => {
    if (isConfirming || isSwiped) return;
    isDraggingRef.current = true;
    startXRef.current = clientX;
  };

  const handleMove = (clientX: number) => {
    if (!isDraggingRef.current || !trackRef.current) return;
    const trackWidth = trackRef.current.clientWidth;
    const maxOffset = trackWidth - 48; // handle is 46px + borders
    const diff = clientX - startXRef.current;
    const offset = Math.max(0, Math.min(diff, maxOffset));
    setDragOffset(offset);

    if (offset >= maxOffset * 0.96) {
      isDraggingRef.current = false;
      setIsSwiped(true);
      setDragOffset(maxOffset);
      onConfirm();
    }
  };

  const handleEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    if (!isSwiped) {
      setDragOffset(0);
    }
  };

  const onTouchStart = (e: React.TouchEvent) => handleStart(e.touches[0].clientX);
  const onTouchMove = (e: React.TouchEvent) => handleMove(e.touches[0].clientX);
  const onTouchEnd = handleEnd;

  const onMouseDown = (e: React.MouseEvent) => handleStart(e.clientX);
  const onMouseMove = (e: React.MouseEvent) => handleMove(e.clientX);
  const onMouseUp = handleEnd;
  const onMouseLeave = handleEnd;

  useEffect(() => {
    if (!isConfirming && isSwiped) {
      setIsSwiped(false);
      setDragOffset(0);
    }
  }, [isConfirming, isSwiped]);

  return (
    <div
      className="swipe-track"
      ref={trackRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      style={{
        position: "relative",
        width: "100%",
        height: "48px",
        background: "var(--surface-soft, #f8fafc)",
        border: "1px solid var(--line, #e2e8f0)",
        borderRadius: "24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        cursor: isConfirming ? "not-allowed" : "grab",
        userSelect: "none"
      }}
    >
      <div
        className="swipe-bg"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: `${dragOffset + 24}px`,
          background: "rgba(99, 102, 241, 0.12)",
          borderRadius: "24px",
          transition: isDraggingRef.current ? "none" : "width 0.3s ease"
        }}
      />

      <span
        className="swipe-text"
        style={{
          fontSize: "12px",
          fontWeight: "800",
          color: isSwiped ? "var(--coral, #6366f1)" : "var(--muted, #64748b)",
          zIndex: 1,
          pointerEvents: "none",
          transition: "opacity 0.2s ease",
          opacity: 1 - dragOffset / 160
        }}
      >
        {isConfirming ? "Confirming..." : isSwiped ? "Updating stock..." : "→ Swipe to Confirm Payment"}
      </span>

      <div
        className="swipe-handle"
        style={{
          position: "absolute",
          left: `${dragOffset + 1}px`,
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          background: "var(--coral, #6366f1)",
          boxShadow: "0 2px 6px rgba(99, 102, 241, 0.3)",
          display: "grid",
          placeItems: "center",
          color: "white",
          transition: isDraggingRef.current ? "none" : "left 0.3s ease",
          zIndex: 2,
          pointerEvents: "none",
          fontWeight: "900",
          fontSize: "16px"
        }}
      >
        ›
      </div>
    </div>
  );
}
