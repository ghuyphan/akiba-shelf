import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Ban, CheckCircle2, CloudOff, Copy, Loader2, ReceiptText, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import type { CartItem, PaymentSettings, PromotionSettings, Order } from "../../types/catalog";
import { formatVnd } from "../../lib/format";
import { calculateCartPricing, getPricingLine } from "../../lib/pricing";
import { useCatalogCopy } from "../../lib/catalogI18n";
import { canGenerateVietQr } from "../../lib/vietqr";
import { Modal } from "../ui/Modal";
import { cancelCustomerOrder, createOrder, getCustomerOrder } from "../../lib/api";
import { clearOrderRecovery, createOrderRecovery, loadOrderRecovery, saveOrderRecovery, type ActiveOrderRecovery } from "../../lib/orderRecovery";
import { useOrderCountdown, usePaymentQrSource } from "../../hooks/useCheckoutPresentation";
import { getPaymentBank } from "../../lib/banks";

type PaymentQrModalProps = {
  shopSlug: string;
  isOpen: boolean;
  payment: PaymentSettings;
  cart: CartItem[];
  promotion: PromotionSettings;
  onClose: () => void;
  onSuccess: () => void;
  onOrderChange?: (order: Order | null) => void;
};

export function PaymentQrModal({ shopSlug, isOpen, payment, cart, promotion, onClose, onSuccess, onOrderChange }: PaymentQrModalProps) {
  const copy = useCatalogCopy();
  // Order flow states
  const [recovery, setRecovery] = useState<ActiveOrderRecovery | null>(() => loadOrderRecovery(shopSlug));
  const [customerName, setCustomerName] = useState(() => recovery?.customerName ?? "");
  const [order, setOrder] = useState<Order | null>(() => recovery?.order ?? null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [connectionState, setConnectionState] = useState<"online" | "reconnecting">(navigator.onLine ? "online" : "reconnecting");
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const completionHandledRef = useRef(false);
  const recoveryAttemptedRef = useRef(false);
  const orderRef = useRef<Order | null>(null);
  const recoveryRef = useRef<ActiveOrderRecovery | null>(recovery);
  const onOrderChangeRef = useRef(onOrderChange);
  const onSuccessRef = useRef(onSuccess);
  const reconcileInFlightRef = useRef(false);
  const loadedShopSlugRef = useRef(shopSlug);
  const checkoutCart = recovery?.cart ?? cart;

  orderRef.current = order;
  recoveryRef.current = recovery;
  onOrderChangeRef.current = onOrderChange;
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    if (loadedShopSlugRef.current === shopSlug) return;
    loadedShopSlugRef.current = shopSlug;
    const next = loadOrderRecovery(shopSlug);
    setRecovery(next); setOrder(next?.order ?? null); setCustomerName(next?.customerName ?? "");
    recoveryAttemptedRef.current = false; completionHandledRef.current = false;
  }, [shopSlug]);

  useEffect(() => {
    if (recovery?.order) onOrderChangeRef.current?.(recovery.order);
  }, [recovery?.order]);

  const pricing = useMemo(
    () => calculateCartPricing(checkoutCart, promotion),
    [checkoutCart, promotion],
  );
  const totalAmount = pricing.total;
  const { qrSrc, isGenerating, qrUnavailable } = usePaymentQrSource(isOpen, order, payment, checkoutCart);

  const submitOrder = useCallback(async (activeRecovery: ActiveOrderRecovery) => {
    setIsSubmittingOrder(true);
    setSubmitError("");
    try {
      const created = await createOrder(shopSlug, activeRecovery.customerName, activeRecovery.cart, activeRecovery.clientRequestId, activeRecovery.recoveryToken);
      const saved = { ...activeRecovery, order: created };
      saveOrderRecovery(saved, shopSlug);
      setRecovery(saved);
      setOrder(created);
      onOrderChange?.(created);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : copy.orderSubmitError);
    } finally {
      setIsSubmittingOrder(false);
    }
  }, [copy, onOrderChange, shopSlug]);

  useEffect(() => {
    if (recoveryAttemptedRef.current || !recovery || recovery.order) return;
    recoveryAttemptedRef.current = true;
    void submitOrder(recovery);
  }, [recovery, submitOrder]);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    const activeRecovery = recovery ?? createOrderRecovery(cart, customerName);
    activeRecovery.customerName = customerName;
    saveOrderRecovery(activeRecovery, shopSlug);
    setRecovery(activeRecovery);
    await submitOrder(activeRecovery);
  };

  const reconcileOrder = useCallback(async () => {
    if (reconcileInFlightRef.current) return;
    const currentOrder = orderRef.current;
    const currentRecovery = recoveryRef.current;
    if (!currentOrder || !currentRecovery) return;
    if (!navigator.onLine) {
      setConnectionState("reconnecting");
      return;
    }
    reconcileInFlightRef.current = true;
    try {
      const fresh = await getCustomerOrder(currentOrder.id, currentRecovery.recoveryToken);
      if (!fresh) throw new Error("Order recovery details are no longer valid.");
      const saved = { ...currentRecovery, order: fresh };
      saveOrderRecovery(saved, shopSlug);
      recoveryRef.current = saved;
      orderRef.current = fresh;
      setRecovery(saved);
      setOrder(fresh);
      onOrderChangeRef.current?.(fresh);
      setConnectionState("online");
      if (fresh.status === "confirmed" && !completionHandledRef.current) {
        completionHandledRef.current = true;
        onSuccessRef.current();
        setShowSuccess(true);
      }
    } catch {
      setConnectionState("reconnecting");
    } finally {
      reconcileInFlightRef.current = false;
    }
  }, [shopSlug]);

  useEffect(() => {
    if (!order || order.status !== "pending") return;
    void reconcileOrder();
    const poll = window.setInterval(() => void reconcileOrder(), connectionState === "online" ? 5000 : 15000);
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
  }, [order, reconcileOrder, connectionState]);

  const handleSuccessClose = () => {
    setShowSuccess(false);
    clearOrderRecovery(shopSlug);
    setRecovery(null);
    setOrder(null);
    onOrderChange?.(null);
    onClose();
  };

  const selectedBank = getPaymentBank(payment.bank_code, payment.bank_acq_id);
  const paymentLabel = canGenerateVietQr(payment) ? (payment.bank_label || selectedBank?.name || payment.bank_code || "Bank transfer") : payment.momo_label;
  const bankName = selectedBank?.name || payment.bank_code || payment.bank_label || "N/A";
  const remaining = useOrderCountdown(order, reconcileOrder);

  async function confirmCancel() {
    if (!order || !recovery || !navigator.onLine) return;
    setIsCancelConfirmOpen(false);
    setIsCancelling(true);
    try { const result = await cancelCustomerOrder(order.id, recovery.recoveryToken); if (result.order) { setOrder(result.order); onOrderChange?.(result.order); saveOrderRecovery({ ...recovery, order: result.order }, shopSlug); } }
    finally { setIsCancelling(false); }
  }

  if (showSuccess) {
    return (
      <Modal title={copy.paymentComplete} isOpen={isOpen} onClose={handleSuccessClose} className="payment-modal payment-success-modal" mobileSheet closeLabel={copy.closeModal}>
        <div className="payment-success-state">
          <div className="success-icon-wrap"><CheckCircle2 size={42} /></div>
          <span className="payment-success-eyebrow">{copy.orderCode} {order?.order_code}</span>
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
      <Modal title={copy.orderCancelled} isOpen={isOpen} onClose={handleSuccessClose} className="payment-modal payment-success-modal" mobileSheet closeLabel={copy.closeModal}>
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

  if (order?.status === "expired") {
    return (
      <Modal title={copy.reservationExpired} isOpen={isOpen} onClose={handleSuccessClose} className="payment-modal payment-success-modal" mobileSheet closeLabel={copy.closeModal}>
        <div className="payment-success-state payment-cancelled-state">
          <Ban size={38} />
          <h2>{copy.reservationExpired}</h2>
          <p>{copy.reservationExpiredHint}</p>
          <button type="button" className="button button-primary" onClick={handleSuccessClose}>{copy.backShop}</button>
        </div>
      </Modal>
    );
  }

  // Step 1: Input Nickname/Name before checkout
  if (!order) {
    return (
      <Modal title={copy.confirmOrder} isOpen={isOpen} onClose={onClose} className="payment-modal order-confirm-modal" mobileSheet closeLabel={copy.closeModal}>
        <form onSubmit={handlePlaceOrder} className="order-confirm-layout">
          <div className="order-confirm-main">
            <div className="order-confirm-intro"><span><ReceiptText size={20} /></span><div><h3>{copy.lastCheck}</h3><p>{copy.reviewCart}</p></div></div>
            <div className="order-confirm-items">{checkoutCart.map((item) => { const image = item.product.images.find(Boolean); const line = getPricingLine(pricing, item.product.id); if (!line) return null; return <div key={item.product.id}>{image ? <img src={image} alt="" /> : <span className="order-confirm-placeholder" />}<div><strong>{item.product.name}</strong><small>{line.quantity} × {formatVnd(line.unitPrice)}{line.freeQuantity > 0 ? ` · ${copy.freeItems(line.freeQuantity)}` : ""}</small></div><b>{formatVnd(line.total)}</b></div>; })}</div>
            {pricing.discountAmount > 0 && <div className="order-confirm-discount"><span>{copy.discount}</span><strong>−{formatVnd(pricing.discountAmount)}</strong></div>}
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
    <>
    <Modal title={copy.scanPay} isOpen={isOpen} onClose={onClose} className="payment-modal payment-qr-modal-redesign" mobileSheet closeLabel={copy.closeModal}>
      <div className="payment-qr-layout">
        <div className="payment-qr-pane">
          <div className="payment-qr-heading"><span>{paymentLabel}</span><strong>{formatVnd(order.total_amount)}</strong><small>{copy.exactNote}</small></div>
          <div className="qr-display payment-qr-display">
          {qrSrc && !isGenerating ? (
            <img src={qrSrc} alt={copy.paymentQrAlt} className="payment-qr-image" />
          ) : qrUnavailable ? (
            <div className="qr-loading payment-qr-loading"><CloudOff size={28} /><span>{copy.qrUnavailable}</span></div>
          ) : (
            <div className="qr-loading payment-qr-loading"><Loader2 size={32} className="spin-icon" />
            </div>
          )}
          </div>
          <div className={`payment-waiting-pill ${connectionState === "reconnecting" ? "is-offline" : ""}`}>{connectionState === "reconnecting" ? <CloudOff size={14} /> : <Loader2 size={14} className="spin-icon" />}<span>{connectionState === "reconnecting" ? copy.reconnectingOrder : copy.waitingConfirmation}</span>
          </div>
          <p className="payment-reservation-copy"><strong>{copy.reservedFor(`${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`)}</strong><br />{copy.reservedWhilePaying}</p>
        </div>

        <div className="payment-receipt payment-receipt-redesign">
          <div className="payment-order-identity"><div><span>{copy.orderCode}</span><strong>{order.order_code}</strong></div>{order.customer_name && <div><span>{copy.pickupName}</span><strong>{order.customer_name}</strong></div>}</div>
          <div className="payment-transfer-card"><span>{copy.transferTo}</span><div><small>{copy.accountName}</small><strong>{payment.bank_account_name || "N/A"}</strong></div><div><small>{copy.accountNumber}</small><button type="button" onClick={() => void navigator.clipboard.writeText(payment.bank_account_no || "")}><strong>{payment.bank_account_no || "N/A"}</strong><Copy size={14} /></button></div><div><small>{copy.bank}</small><strong>{bankName}</strong></div><div className="payment-transfer-note"><small>{copy.transferNote}</small><strong>{order.order_code}</strong></div></div>
          <div className="payment-receipt-items"><span>{copy.orderSummary}</span>{checkoutCart.map((item) => { const line = getPricingLine(pricing, item.product.id); if (!line) return null; return <div key={item.product.id}><span>{line.quantity} × {item.product.name}{line.freeQuantity > 0 ? ` · ${copy.freeItems(line.freeQuantity)}` : ""}</span>{totalAmount === order.total_amount && <strong>{formatVnd(line.total)}</strong>}</div>; })}{pricing.discountAmount > 0 && <div className="payment-receipt-discount"><span>{copy.discount}</span><strong>−{formatVnd(pricing.discountAmount)}</strong></div>}<div className="payment-receipt-total"><span>{copy.total}</span><strong>{formatVnd(order.total_amount)}</strong></div></div>
          {payment.payment_instructions.trim() && <div className="receipt-instructions"><Sparkles size={16} /><span>{payment.payment_instructions}</span></div>}
          <button type="button" className="payment-hide-order" onClick={onClose}>{copy.hidePayment}</button><button type="button" className="button button-secondary" onClick={() => setIsCancelConfirmOpen(true)} disabled={isCancelling || connectionState !== "online"}>{isCancelling ? copy.cancelling : copy.cancelOrder}</button>
        </div>
      </div>
    </Modal>
    <Modal
      title={copy.cancelReservationTitle}
      isOpen={isCancelConfirmOpen}
      onClose={() => setIsCancelConfirmOpen(false)}
      className="payment-modal"
      mobileSheet
      closeLabel={copy.closeModal}
    >
      <div className="payment-success-state payment-cancelled-state">
        <Ban size={38} />
        <p>{copy.cancelReservationHint}</p>
        <div className="order-confirm-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setIsCancelConfirmOpen(false)}
            disabled={isCancelling}
          >
            {copy.keepOrder}
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => void confirmCancel()}
            disabled={isCancelling}
          >
            {isCancelling ? copy.cancelling : copy.cancelOrder}
          </button>
        </div>
      </div>
    </Modal>
    </>
  );
}
