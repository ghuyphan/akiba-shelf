import { useEffect, useMemo, useState, useRef } from "react";
import { CheckCircle2, Sparkles, Loader2 } from "lucide-react";
import type { CartItem, PaymentSettings, Order } from "../../types/catalog";
import { formatVnd } from "../../lib/format";
import { canGenerateVietQr, generateVietQrForCart } from "../../lib/vietqr";
import { Modal } from "../ui/Modal";
import { createOrder } from "../../lib/api";
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
  
  // Order flow states
  const [customerName, setCustomerName] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  // Reset order state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setOrder(null);
      setCustomerName("");
      setSubmitError("");
      setShowSuccess(false);
      setQrSrc("");
    }
  }, [isOpen]);

  const totalAmount = useMemo(
    () => cart.reduce((sum, item) => sum + item.product.price_vnd * item.quantity, 0),
    [cart],
  );

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    setIsSubmittingOrder(true);
    setSubmitError("");
    try {
      const created = await createOrder(customerName, cart);
      setOrder(created);
    } catch (err: any) {
      setSubmitError(err.message || "Failed to submit order. Please try again.");
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Generate QR when order is created
  useEffect(() => {
    if (!isOpen || !order) return;
    let cancelled = false;
    const orderCode = order.order_code;

    async function loadQr() {
      setIsGenerating(true);
      const generated = await generateVietQrForCart(payment, cart, orderCode).catch(() => null);
      if (!cancelled) {
        setQrSrc(generated?.src || payment.bank_qr_url || payment.momo_qr_url);
        setIsGenerating(false);
      }
    }

    void loadQr();
    return () => {
      cancelled = true;
    };
  }, [isOpen, order, payment, cart]);

  // Subscribe to real-time order status updates from Supabase
  useEffect(() => {
    if (!supabase || !order) return undefined;

    const client = supabase;
    const orderId = order.id;
    const channel = client
      .channel(`order-tracker-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          if (payload.new.status === "confirmed") {
            onSuccess();
            setShowSuccess(true);
          }
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [order, onSuccess]);

  const handleSuccessClose = () => {
    setShowSuccess(false);
    onClose();
  };

  const title = order 
    ? (canGenerateVietQr(payment) ? payment.bank_label : payment.momo_label)
    : "Enter Nickname";

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

  // Step 1: Input Nickname/Name before checkout
  if (!order) {
    return (
      <Modal title={title} isOpen={isOpen} onClose={onClose} className="payment-modal">
        <form onSubmit={handlePlaceOrder} className="stack" style={{ display: "grid", gap: "16px", padding: "10px 0" }}>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "4px" }}>Pickup Name</h3>
            <p style={{ fontSize: "13px", color: "var(--muted)" }}>
              Enter a name or nickname so the staff can match your payment and package your items.
            </p>
          </div>
          <input
            type="text"
            placeholder="Nickname (e.g. Huy, Alice)"
            className="input"
            style={{ minHeight: "44px", height: "44px", padding: "0 14px", fontSize: "15px", width: "100%" }}
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            maxLength={30}
            required
          />
          {submitError && <div style={{ color: "var(--red)", fontSize: "13px" }}>{submitError}</div>}
          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button
              type="button"
              className="button button-secondary"
              style={{ flex: 1, minHeight: "44px" }}
              onClick={onClose}
              disabled={isSubmittingOrder}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button button-primary"
              style={{ flex: 1, minHeight: "44px" }}
              disabled={isSubmittingOrder || cart.length === 0}
            >
              {isSubmittingOrder ? "Submitting..." : "Get QR Code"}
            </button>
          </div>
        </form>
      </Modal>
    );
  }

  // Step 2: Show QR & Wait for Staff approval
  return (
    <Modal title={title} isOpen={isOpen} onClose={onClose} className="payment-modal">
      <div className="qr-modal-layout" style={{ display: "grid", gap: "20px" }}>
        <div className="qr-display" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", width: "100%" }}>
          {qrSrc && !isGenerating ? (
            <img src={qrSrc} alt="Payment QR code" style={{ maxWidth: "260px", width: "100%", height: "auto", borderRadius: "12px", border: "1px solid var(--line)" }} />
          ) : (
            <div className="qr-loading" style={{ width: "260px", height: "260px", background: "var(--surface-soft)", borderRadius: "12px", display: "grid", placeItems: "center" }}>
              <Loader2 className="animate-spin" size={32} style={{ animation: "spin 1s linear infinite" }} />
            </div>
          )}
          
          <div 
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "8px", 
              padding: "10px 20px", 
              background: "rgba(99, 102, 241, 0.08)", 
              borderRadius: "24px",
              color: "var(--coral, #6366f1)",
              fontSize: "13px",
              fontWeight: "600"
            }}
          >
            <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
            <span>Waiting for staff approval...</span>
          </div>
        </div>

        <div className="payment-receipt" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="receipt-header" style={{ background: "var(--surface-soft)", padding: "14px", borderRadius: "12px", border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--muted)", textTransform: "uppercase" }}>Order Code</span>
                <h3 style={{ fontSize: "22px", fontWeight: "900", color: "var(--coral, #6366f1)", margin: 0 }}>{order.order_code}</h3>
              </div>
              {order.customer_name && (
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--muted)", textTransform: "uppercase" }}>Nickname</span>
                  <p style={{ fontSize: "16px", fontWeight: "700", margin: 0 }}>{order.customer_name}</p>
                </div>
              )}
            </div>
          </div>

          <div className="receipt-divider" />

          {cart.length > 0 && (
            <div className="receipt-section">
              <span className="receipt-label">Order Details</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {cart.map((item) => (
                  <div key={item.product.id} className="receipt-row" style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                    <span className="receipt-item-name" style={{ color: "var(--ink)", fontWeight: "500" }}>
                      {item.quantity} x {item.product.name}
                    </span>
                    <span className="receipt-item-price" style={{ fontWeight: "700" }}>{formatVnd(item.product.price_vnd * item.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="receipt-divider" />

          <div className="receipt-section">
            <span className="receipt-label">Transfer Details</span>
            <div className="receipt-details-list" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div className="receipt-detail-row" style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                <span style={{ color: "var(--muted)" }}>Account Name</span>
                <strong>{payment.bank_account_name || "N/A"}</strong>
              </div>
              <div className="receipt-detail-row" style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                <span style={{ color: "var(--muted)" }}>Account Number</span>
                <strong
                  style={{ cursor: "pointer", textDecoration: "underline" }}
                  title="Click to copy account number"
                  onClick={() => {
                    void navigator.clipboard.writeText(payment.bank_account_no || "");
                  }}
                >
                  {payment.bank_account_no || "N/A"}
                </strong>
              </div>
              <div className="receipt-detail-row" style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                <span style={{ color: "var(--muted)" }}>Bank Name</span>
                <strong>{title}</strong>
              </div>
              <div className="receipt-detail-row" style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                <span style={{ color: "var(--muted)" }}>Transfer Note</span>
                <strong style={{ color: "var(--coral, #6366f1)" }}>{order.order_code}</strong>
              </div>
            </div>
          </div>

          {payment.payment_instructions && (
            <>
              <div className="receipt-divider" />
              <div className="receipt-instructions" style={{ display: "flex", gap: "8px", alignItems: "flex-start", padding: "10px", background: "var(--surface-soft)", borderRadius: "8px", fontSize: "13px", color: "var(--muted)" }}>
                <Sparkles size={16} style={{ color: "var(--amber)", marginTop: "2px", flexShrink: 0 }} />
                <span>{payment.payment_instructions}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

// Re-export SwipeConfirmButton for use in Admin Queue dashboard
type SwipeConfirmButtonProps = {
  onConfirm: () => void;
  isConfirming: boolean;
};

export function SwipeConfirmButton({ onConfirm, isConfirming }: SwipeConfirmButtonProps) {
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
    const maxOffset = trackWidth - 48; // handle is 44px + border/paddings
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
          left: `${dragOffset + 2}px`,
          width: "42px",
          height: "42px",
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
