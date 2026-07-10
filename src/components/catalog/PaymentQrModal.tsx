import { useEffect, useMemo, useState, useRef } from "react";
import { CheckCircle2, Copy, Loader2, ReceiptText, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import type { CartItem, PaymentSettings, Order } from "../../types/catalog";
import { formatVnd } from "../../lib/format";
import { useCatalogCopy } from "../../lib/catalogI18n";
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
  const copy = useCatalogCopy();
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
    const orderTotal = order.total_amount;

    async function loadQr() {
      setIsGenerating(true);
      const generated = await generateVietQrForCart(payment, cart, orderCode, orderTotal).catch(() => null);
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

  const paymentLabel = canGenerateVietQr(payment) ? payment.bank_label : payment.momo_label;

  if (showSuccess) {
    return (
      <Modal title={copy.paymentComplete} isOpen={isOpen} onClose={handleSuccessClose} className="payment-modal payment-success-modal">
        <div className="payment-success-state">
          <div className="success-icon-wrap"><CheckCircle2 size={42} /></div>
          <span className="payment-success-eyebrow">Order {order?.order_code}</span>
          <h2>{copy.allSet}</h2>
          <p>{copy.reservedPickup}</p>
          <div className="payment-success-summary"><span>{copy.totalPaid}</span><strong>{formatVnd(order?.total_amount ?? totalAmount)}</strong></div>
          <button type="button" className="button button-primary" onClick={handleSuccessClose}>{copy.backShop}</button>
        </div>
      </Modal>
    );
  }

  // Step 1: Input Nickname/Name before checkout
  if (!order) {
    return (
      <Modal title={copy.confirmOrder} isOpen={isOpen} onClose={onClose} className="payment-modal order-confirm-modal">
        <form onSubmit={handlePlaceOrder} className="order-confirm-layout">
          <div className="order-confirm-main">
            <div className="order-confirm-intro"><span><ReceiptText size={20} /></span><div><h3>{copy.lastCheck}</h3><p>{copy.reviewCart}</p></div></div>
            <div className="order-confirm-items">{cart.map((item) => { const image = item.product.images.find(Boolean); return <div key={item.product.id}>{image ? <img src={image} alt="" /> : <span className="order-confirm-placeholder" />}<div><strong>{item.product.name}</strong><small>{item.quantity} × {formatVnd(item.product.price_vnd)}</small></div><b>{formatVnd(item.product.price_vnd * item.quantity)}</b></div>; })}</div>
            <div className="order-confirm-total"><span>{copy.total}</span><strong>{formatVnd(totalAmount)}</strong></div>
          </div>
          <div className="order-confirm-side">
            <label className="order-confirm-name"><span>{copy.pickupName}</span><div><UserRound size={18} /><input type="text" placeholder={copy.pickupPlaceholder} value={customerName} onChange={(event) => setCustomerName(event.target.value)} maxLength={30} required autoFocus /></div><small>{copy.pickupHint}</small></label>
            <div className="order-confirm-secure"><ShieldCheck size={17} /><span>{copy.secureCheck}</span></div>
            {submitError && <div className="payment-submit-error">{submitError}</div>}
            <div className="order-confirm-actions"><button type="button" className="button button-secondary" onClick={onClose} disabled={isSubmittingOrder}>{copy.keepShopping}</button><button type="submit" className="button button-primary" disabled={isSubmittingOrder || cart.length === 0}>{isSubmittingOrder ? <><Loader2 size={16} className="spin-icon" /> {copy.checking}</> : copy.createPay}</button></div>
          </div>
        </form>
      </Modal>
    );
  }

  // Step 2: Show QR & Wait for Staff approval
  return (
    <Modal title={copy.scanPay} isOpen={isOpen} onClose={onClose} className="payment-modal payment-qr-modal-redesign">
      <div className="payment-qr-layout">
        <div className="payment-qr-pane">
          <div className="payment-qr-heading"><span>{paymentLabel}</span><strong>{formatVnd(order.total_amount)}</strong><small>{copy.exactNote}</small></div>
          <div className="qr-display payment-qr-display">
          {qrSrc && !isGenerating ? (
            <img src={qrSrc} alt="Payment QR code" className="payment-qr-image" />
          ) : (
            <div className="qr-loading payment-qr-loading"><Loader2 size={32} className="spin-icon" />
            </div>
          )}
          </div>
          <div className="payment-waiting-pill"><Loader2 size={14} className="spin-icon" /><span>{copy.waitingConfirmation}</span>
          </div>
        </div>

        <div className="payment-receipt payment-receipt-redesign">
          <div className="payment-order-identity"><div><span>{copy.orderCode}</span><strong>{order.order_code}</strong></div>{order.customer_name && <div><span>{copy.pickupName}</span><strong>{order.customer_name}</strong></div>}</div>
          <div className="payment-transfer-card"><span>{copy.transferTo}</span><div><small>{copy.accountName}</small><strong>{payment.bank_account_name || "N/A"}</strong></div><div><small>{copy.accountNumber}</small><button type="button" onClick={() => void navigator.clipboard.writeText(payment.bank_account_no || "")}><strong>{payment.bank_account_no || "N/A"}</strong><Copy size={14} /></button></div><div><small>{copy.bank}</small><strong>{paymentLabel}</strong></div><div className="payment-transfer-note"><small>{copy.transferNote}</small><strong>{order.order_code}</strong></div></div>
          <div className="payment-receipt-items"><span>{copy.orderSummary}</span>{cart.map((item) => <div key={item.product.id}><span>{item.quantity} × {item.product.name}</span><strong>{formatVnd(item.product.price_vnd * item.quantity)}</strong></div>)}<div className="payment-receipt-total"><span>{copy.total}</span><strong>{formatVnd(order.total_amount)}</strong></div></div>
          {payment.payment_instructions && <div className="receipt-instructions"><Sparkles size={16} /><span>{payment.payment_instructions}</span></div>}
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
