import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Ban, Check, CheckCircle2, CloudOff, Copy, Loader2, ReceiptText, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import type { CartItem, PaymentSettings, Order } from "../../types/catalog";
import { formatVnd } from "../../lib/format";
import { useCatalogCopy } from "../../lib/catalogI18n";
import { canGenerateVietQr, generateVietQrForCart } from "../../lib/vietqr";
import { Modal } from "../ui/Modal";
import { createOrder, getCustomerOrder } from "../../lib/api";
import { clearOrderRecovery, createOrderRecovery, loadOrderRecovery, saveOrderRecovery, type ActiveOrderRecovery } from "../../lib/orderRecovery";

type PaymentQrModalProps = {
  isOpen: boolean;
  payment: PaymentSettings;
  cart: CartItem[];
  onClose: () => void;
  onSuccess: () => void;
  onOrderChange?: (order: Order | null) => void;
};

export function PaymentQrModal({ isOpen, payment, cart, onClose, onSuccess, onOrderChange }: PaymentQrModalProps) {
  const copy = useCatalogCopy();
  const [qrSrc, setQrSrc] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Order flow states
  const [customerName, setCustomerName] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [recovery, setRecovery] = useState<ActiveOrderRecovery | null>(() => loadOrderRecovery());
  const [connectionState, setConnectionState] = useState<"online" | "reconnecting">(navigator.onLine ? "online" : "reconnecting");
  const completionHandledRef = useRef(false);
  const checkoutCart = recovery?.cart ?? cart;

  useEffect(() => {
    if (!recovery) return;
    setCustomerName(recovery.customerName);
    if (recovery.order) {
      setOrder(recovery.order);
      onOrderChange?.(recovery.order);
    }
  }, []);

  const totalAmount = useMemo(
    () => checkoutCart.reduce((sum, item) => sum + item.product.price_vnd * item.quantity, 0),
    [checkoutCart],
  );

  const submitOrder = useCallback(async (activeRecovery: ActiveOrderRecovery) => {
    setIsSubmittingOrder(true);
    setSubmitError("");
    try {
      const created = await createOrder(activeRecovery.customerName, activeRecovery.cart, activeRecovery.clientRequestId, activeRecovery.recoveryToken);
      const saved = { ...activeRecovery, order: created };
      saveOrderRecovery(saved);
      setRecovery(saved);
      setOrder(created);
      onOrderChange?.(created);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit order. Please try again.");
    } finally {
      setIsSubmittingOrder(false);
    }
  }, [onOrderChange]);

  useEffect(() => {
    if (recovery && !recovery.order && !isSubmittingOrder && !submitError) void submitOrder(recovery);
  }, []);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    const activeRecovery = recovery ?? createOrderRecovery(cart, customerName);
    activeRecovery.customerName = customerName;
    saveOrderRecovery(activeRecovery);
    setRecovery(activeRecovery);
    await submitOrder(activeRecovery);
  };

  // Generate QR when order is created
  useEffect(() => {
    if (!isOpen || !order) return;
    let cancelled = false;
    const orderCode = order.order_code;
    const orderTotal = order.total_amount;

    async function loadQr() {
      setIsGenerating(true);
      const generated = await generateVietQrForCart(payment, checkoutCart, orderCode, orderTotal).catch(() => null);
      if (!cancelled) {
        setQrSrc(generated?.src || payment.bank_qr_url || payment.momo_qr_url);
        setIsGenerating(false);
      }
    }

    void loadQr();
    return () => {
      cancelled = true;
    };
  }, [isOpen, order, payment, checkoutCart]);

  const reconcileOrder = useCallback(async () => {
    if (!order || !recovery) return;
    if (!navigator.onLine) {
      setConnectionState("reconnecting");
      return;
    }
    try {
      const fresh = await getCustomerOrder(order.id, recovery.recoveryToken);
      if (!fresh) throw new Error("Order recovery details are no longer valid.");
      const saved = { ...recovery, order: fresh };
      saveOrderRecovery(saved);
      setRecovery(saved);
      setOrder(fresh);
      onOrderChange?.(fresh);
      setConnectionState("online");
      if (fresh.status === "confirmed" && !completionHandledRef.current) {
        completionHandledRef.current = true;
        onSuccess();
        setShowSuccess(true);
      }
    } catch {
      setConnectionState("reconnecting");
    }
  }, [order, recovery, onOrderChange, onSuccess]);

  useEffect(() => {
    if (!order || order.status !== "pending") return;
    void reconcileOrder();
    const poll = window.setInterval(() => void reconcileOrder(), connectionState === "online" ? 5000 : 2500);
    const handleOnline = () => void reconcileOrder();
    const handleOffline = () => setConnectionState("reconnecting");
    const handleFocus = () => void reconcileOrder();
    const handleVisibility = () => { if (document.visibilityState === "visible") void reconcileOrder(); };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [order?.id, order?.status, reconcileOrder, connectionState]);

  const handleSuccessClose = () => {
    setShowSuccess(false);
    clearOrderRecovery();
    setRecovery(null);
    setOrder(null);
    onOrderChange?.(null);
    onClose();
  };

  const paymentLabel = canGenerateVietQr(payment) ? payment.bank_label : payment.momo_label;

  if (showSuccess) {
    return (
      <Modal title={copy.paymentComplete} isOpen={isOpen} onClose={handleSuccessClose} className="payment-modal payment-success-modal" mobileSheet>
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

  if (order?.status === "cancelled") {
    return (
      <Modal title={copy.orderCancelled} isOpen={isOpen} onClose={handleSuccessClose} className="payment-modal payment-success-modal" mobileSheet>
        <div className="payment-success-state payment-cancelled-state">
          <div className="success-icon-wrap"><Ban size={38} /></div>
          <span className="payment-success-eyebrow">{copy.orderCode} {order.order_code}</span>
          <h2>{copy.orderCancelled}</h2>
          <p>{copy.cancelledPaymentNote}</p>
          <button type="button" className="button button-primary" onClick={handleSuccessClose}>{copy.backShop}</button>
        </div>
      </Modal>
    );
  }

  // Step 1: Input Nickname/Name before checkout
  if (!order) {
    return (
      <Modal title={copy.confirmOrder} isOpen={isOpen} onClose={onClose} className="payment-modal order-confirm-modal" mobileSheet>
        <form onSubmit={handlePlaceOrder} className="order-confirm-layout">
          <div className="order-confirm-main">
            <div className="order-confirm-intro"><span><ReceiptText size={20} /></span><div><h3>{copy.lastCheck}</h3><p>{copy.reviewCart}</p></div></div>
            <div className="order-confirm-items">{checkoutCart.map((item) => { const image = item.product.images.find(Boolean); return <div key={item.product.id}>{image ? <img src={image} alt="" /> : <span className="order-confirm-placeholder" />}<div><strong>{item.product.name}</strong><small>{item.quantity} × {formatVnd(item.product.price_vnd)}</small></div><b>{formatVnd(item.product.price_vnd * item.quantity)}</b></div>; })}</div>
            <div className="order-confirm-total"><span>{copy.total}</span><strong>{formatVnd(totalAmount)}</strong></div>
          </div>
          <div className="order-confirm-side">
            <label className="order-confirm-name"><span>{copy.pickupName}</span><div><UserRound size={18} /><input type="text" placeholder={copy.pickupPlaceholder} value={customerName} onChange={(event) => setCustomerName(event.target.value)} maxLength={30} required autoFocus /></div><small>{copy.pickupHint}</small></label>
            <div className="order-confirm-secure"><ShieldCheck size={17} /><span>{copy.secureCheck}</span></div>
            {submitError && <div className="payment-submit-error">{submitError}</div>}
            <div className="order-confirm-actions"><button type="button" className="button button-secondary" onClick={onClose} disabled={isSubmittingOrder}>{copy.keepShopping}</button><button type="submit" className="button button-primary" disabled={isSubmittingOrder || checkoutCart.length === 0}>{isSubmittingOrder ? <><Loader2 size={16} className="spin-icon" /> {copy.checking}</> : recovery ? copy.retryOrder : copy.createPay}</button></div>
          </div>
        </form>
      </Modal>
    );
  }

  // Step 2: Show QR & Wait for Staff approval
  return (
    <Modal title={copy.scanPay} isOpen={isOpen} onClose={onClose} className="payment-modal payment-qr-modal-redesign" mobileSheet>
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
          <div className={`payment-waiting-pill ${connectionState === "reconnecting" ? "is-offline" : ""}`}>{connectionState === "reconnecting" ? <CloudOff size={14} /> : <Loader2 size={14} className="spin-icon" />}<span>{connectionState === "reconnecting" ? copy.reconnectingOrder : copy.waitingConfirmation}</span>
          </div>
        </div>

        <div className="payment-receipt payment-receipt-redesign">
          <div className="payment-order-identity"><div><span>{copy.orderCode}</span><strong>{order.order_code}</strong></div>{order.customer_name && <div><span>{copy.pickupName}</span><strong>{order.customer_name}</strong></div>}</div>
          <div className="payment-transfer-card"><span>{copy.transferTo}</span><div><small>{copy.accountName}</small><strong>{payment.bank_account_name || "N/A"}</strong></div><div><small>{copy.accountNumber}</small><button type="button" onClick={() => void navigator.clipboard.writeText(payment.bank_account_no || "")}><strong>{payment.bank_account_no || "N/A"}</strong><Copy size={14} /></button></div><div><small>{copy.bank}</small><strong>{paymentLabel}</strong></div><div className="payment-transfer-note"><small>{copy.transferNote}</small><strong>{order.order_code}</strong></div></div>
          <div className="payment-receipt-items"><span>{copy.orderSummary}</span>{checkoutCart.map((item) => <div key={item.product.id}><span>{item.quantity} × {item.product.name}</span><strong>{formatVnd(item.product.price_vnd * item.quantity)}</strong></div>)}<div className="payment-receipt-total"><span>{copy.total}</span><strong>{formatVnd(order.total_amount)}</strong></div></div>
          <button type="button" className="payment-hide-order" onClick={onClose}>{copy.hidePayment}</button>
          {payment.payment_instructions && <div className="receipt-instructions"><Sparkles size={16} /><span>{payment.payment_instructions}</span></div>}
        </div>
      </div>
    </Modal>
  );
}

// Re-export SwipeConfirmButton for use in Admin Queue dashboard
type SwipeConfirmButtonProps = {
  onConfirm: () => boolean | Promise<boolean>;
  isConfirming: boolean;
};

export function SwipeConfirmButton({ onConfirm, isConfirming }: SwipeConfirmButtonProps) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "dragging" | "committing" | "success" | "error">("idle");
  const trackRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const phaseRef = useRef<typeof phase>("idle");
  const startXRef = useRef(0);
  const lastXRef = useRef(0);
  const lastTimeRef = useRef(0);

  const updateProgress = (next: number) => { progressRef.current = next; setProgress(next); };
  const updatePhase = (next: typeof phase) => { phaseRef.current = next; setPhase(next); };

  const commit = useCallback(async () => {
    if (phaseRef.current === "committing" || phaseRef.current === "success" || isConfirming) return;
    updateProgress(1);
    updatePhase("committing");
    const succeeded = await onConfirm();
    if (succeeded) {
      updatePhase("success");
      return;
    }
    updatePhase("error");
    window.setTimeout(() => { updateProgress(0); updatePhase("idle"); }, 700);
  }, [isConfirming, onConfirm]);

  const finishGesture = (velocity = 0) => {
    if (phaseRef.current !== "dragging") return;
    if (progressRef.current >= 0.88 || (progressRef.current >= 0.68 && velocity > 0.55)) void commit();
    else { updateProgress(0); updatePhase("idle"); }
  };

  return (
    <div
      className={`swipe-track phase-${phase}`}
      ref={trackRef}
      role="button"
      tabIndex={isConfirming ? -1 : 0}
      aria-label="Swipe right or press Enter to confirm payment and update stock"
      aria-disabled={isConfirming || phase === "committing"}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          void commit();
        }
      }}
      onPointerDown={(event) => {
        if (isConfirming || phaseRef.current !== "idle") return;
        event.currentTarget.setPointerCapture(event.pointerId);
        startXRef.current = event.clientX;
        lastXRef.current = event.clientX;
        lastTimeRef.current = performance.now();
        updatePhase("dragging");
      }}
      onPointerMove={(event) => {
        if (phaseRef.current !== "dragging" || !trackRef.current) return;
        const maxTravel = Math.max(1, trackRef.current.clientWidth - 54);
        updateProgress(Math.max(0, Math.min(1, (event.clientX - startXRef.current) / maxTravel)));
        lastXRef.current = event.clientX;
        lastTimeRef.current = performance.now();
      }}
      onPointerUp={(event) => {
        const elapsed = Math.max(1, performance.now() - lastTimeRef.current);
        finishGesture((event.clientX - lastXRef.current) / elapsed);
      }}
      onPointerCancel={() => finishGesture()}
      style={{ "--swipe-progress": progress } as React.CSSProperties}
    >
      <div className="swipe-bg" />
      <span className="swipe-text">{phase === "committing" || isConfirming ? "Confirming payment…" : phase === "success" ? "Payment confirmed" : phase === "error" ? "Could not confirm — try again" : "Swipe to confirm payment"}</span>
      <div className="swipe-handle">{phase === "success" ? <Check size={19} /> : phase === "committing" ? <Loader2 size={18} className="spin-icon" /> : <span>›</span>}</div>
      <span className="sr-only" aria-live="polite">{phase === "success" ? "Payment confirmed and stock updated" : phase === "error" ? "Confirmation failed. Try again." : ""}</span>
    </div>
  );
}
