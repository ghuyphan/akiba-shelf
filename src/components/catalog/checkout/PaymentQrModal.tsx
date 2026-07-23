import { useMemo, useState } from "react";
import { Ban, CheckCircle2, CircleAlert, CloudOff, Copy, Loader2, ReceiptText, RefreshCw, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import type { CartItem, PaymentSettings, PromotionSettings, Order, BoothSettings, CheckoutSession } from "../../../types/catalog";
import { formatVnd } from "../../../utils/format";
import { calculateCartPricing, getPricingLine } from "../../../utils/pricing";
import { useCatalogCopy } from "../../../lib/i18n/catalogI18n";
import { canGenerateVietQr, hasUsablePayment } from "../../../utils/vietqr";
import { Modal } from "../../ui/Modal";
import { useOrderCountdown, usePaymentQrSource } from "../../../hooks/catalog/useCheckoutPresentation";
import { getPaymentBank, getBankLogoUrl } from "../../../utils/banks";
import { useCheckoutSession } from "../../../hooks/catalog/useCheckoutSession";

type PaymentQrModalProps = {
  shopSlug: string;
  isOpen: boolean;
  payment: PaymentSettings;
  cart: CartItem[];
  promotion: PromotionSettings;
  onClose: () => void;
  onSuccess: () => void;
  onOrderChange?: (order: Order | null) => void;
  onSessionChange?: (session: CheckoutSession | null) => void;
  booth?: BoothSettings;
};

function PaymentQrLoading({ label }: { label: string }) {
  return (
    <div className="payment-qr-loading" role="status" aria-live="polite">
      <div className="payment-qr-loading-card" aria-hidden="true">
        <span className="payment-qr-loading-brand" />
        <span className="payment-qr-loading-code">
          <span className="payment-qr-loading-finder is-top-left" />
          <span className="payment-qr-loading-finder is-top-right" />
          <span className="payment-qr-loading-finder is-bottom-left" />
          <span className="payment-qr-loading-spinner"><Loader2 size={24} className="spin-icon" /></span>
        </span>
        <span className="payment-qr-loading-detail" />
        <span className="payment-qr-loading-detail is-short" />
      </div>
      <strong>{label}</strong>
    </div>
  );
}

export function PaymentQrModal({ shopSlug, isOpen, payment, cart, promotion, onClose, onSuccess, onOrderChange, onSessionChange, booth }: PaymentQrModalProps) {
  const copy = useCatalogCopy();
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const checkout = useCheckoutSession({
    shopSlug,
    cart,
    onOrderChange,
    onSessionChange,
    onConfirmed: onSuccess,
  });
  const { session, order, connectionState, isSubmitting, isCancelling } = checkout;
  const [customerName, setCustomerName] = useState(() => session?.customerName ?? "");
  const [customerNameError, setCustomerNameError] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");
  const checkoutCart = session?.cart ?? cart;

  const pricing = useMemo(
    () => calculateCartPricing(checkoutCart, promotion),
    [checkoutCart, promotion],
  );
  const totalAmount = pricing.total;
  const paymentReady = hasUsablePayment(payment);
  const { qrSrc, isGenerating, qrUnavailable } = usePaymentQrSource(isOpen, order, payment, checkoutCart);
  const centerLogoUrl = booth?.logo_url || booth?.social_qr_logo_url || `${import.meta.env.BASE_URL}brand/matsuri-mark.svg`;

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || !paymentReady) return;
    const trimmedName = customerName.trim();
    if (!trimmedName) {
      setCustomerNameError(copy.pickupRequired);
      return;
    }
    setCustomerNameError("");
    await checkout.start(trimmedName);
  };

  const handleSuccessClose = () => {
    checkout.clear();
    onClose();
  };

  const selectedBank = getPaymentBank(payment.bank_code, payment.bank_acq_id, payment.bank_label);
  const bankName = selectedBank?.name || payment.bank_code || payment.bank_label || "N/A";
  const remaining = useOrderCountdown(order, checkout.refreshOrder);

  async function confirmCancel() {
    if (!order || (!navigator.onLine && order.source !== "offline_event")) return;
    setIsCancelConfirmOpen(false);
    await checkout.cancel();
  }

  async function copyAccountNumber() {
    const accountNumber = (payment.bank_account_no ?? "").trim();
    if (!accountNumber || !navigator.clipboard) {
      setCopyFeedback(copy.copyAccountNumberFailed);
      return;
    }
    try {
      await navigator.clipboard.writeText(accountNumber);
      setCopyFeedback(copy.accountNumberCopied);
    } catch {
      setCopyFeedback(copy.copyAccountNumberFailed);
    }
  }

  if (order?.status === "confirmed") {
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

  if (session && !order && !isSubmitting) {
    const needsReview = session.state === "needs_review";
    const eventStorageUnavailable = session.lastErrorCode === "offline_event_storage_unavailable";
    const isOffline = connectionState === "offline";
    const title = needsReview
      ? copy.checkoutUnavailableTitle
      : eventStorageUnavailable
        ? copy.checkoutUnavailableTitle
      : isOffline
        ? copy.reconnectCheckoutTitle
        : copy.checkoutConnectionTitle;
    return (
      <Modal
        title={title}
        isOpen={isOpen}
        onClose={onClose}
        className="payment-modal payment-success-modal"
        mobileSheet
        closeLabel={copy.closeModal}
      >
        <div className="payment-success-state payment-cancelled-state">
          <div className="success-icon-wrap">
            {needsReview ? <CircleAlert size={38} /> : isOffline ? <CloudOff size={38} /> : <RefreshCw size={38} />}
          </div>
          <h2>{title}</h2>
          <p>{eventStorageUnavailable ? copy.offlineEventStorageError : needsReview ? session.lastError || copy.orderSubmitError : isOffline ? copy.cartSavedOffline : copy.checkoutConnectionHint}</p>
          <div className="payment-success-summary">
            <span>{copy.total}</span>
            <strong>{formatVnd(totalAmount)}</strong>
          </div>
          <div className="order-confirm-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                if (needsReview) checkout.clear();
                onClose();
              }}
              disabled={isSubmitting}
            >
              {copy.keepShopping}
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={() => void checkout.retry()}
              disabled={isSubmitting}
            >
              {isSubmitting ? <><Loader2 size={16} className="spin-icon" /> {copy.checking}</> : copy.retryOrder}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  if (!order) {
    return (
      <>
        <Modal title={copy.scanPay} isOpen={isOpen} onClose={onClose} className="payment-modal payment-qr-modal-redesign checkout-flow-modal" mobileSheet closeLabel={copy.closeModal}>
          {isSubmitting ? (
            <div className="payment-qr-layout payment-qr-preparing-layout">
              <div className="payment-qr-pane">
                <div className="payment-qr-heading"><span>{copy.payNow}</span><strong>{formatVnd(totalAmount)}</strong><small>{copy.preparingOrderHint}</small></div>
                <PaymentQrLoading label={copy.preparingOrder} />
              </div>
              <div className="payment-receipt payment-receipt-redesign payment-receipt-preparing">
                <div className="payment-preparing-note"><ShieldCheck size={17} /><span>{copy.secureCheck}</span></div>
                <div className="payment-receipt-items"><span>{copy.orderSummary}</span>{checkoutCart.map((item) => { const line = getPricingLine(pricing, item.product.id); if (!line) return null; return <div key={item.product.id}><span>{line.quantity} × {item.product.name}{line.freeQuantity > 0 ? ` · ${copy.freeItems(line.freeQuantity)}` : ""}</span><strong>{formatVnd(line.total)}</strong></div>; })}{pricing.discountAmount > 0 && <div className="payment-receipt-discount"><span>{copy.discount}</span><strong>−{formatVnd(pricing.discountAmount)}</strong></div>}<div className="payment-receipt-total"><span>{copy.total}</span><strong>{formatVnd(totalAmount)}</strong></div></div>
              </div>
            </div>
          ) : (
          <form onSubmit={handlePlaceOrder} className="order-confirm-layout" noValidate>
            <div className="order-confirm-main">
              <div className="order-confirm-intro"><span><ReceiptText size={20} /></span><div><h3>{copy.lastCheck}</h3><p>{copy.reviewCart}</p></div></div>
              <div className="order-confirm-items">{checkoutCart.map((item) => { const image = item.product.image_variants?.[0]?.thumbnail || item.product.images.find(Boolean); const line = getPricingLine(pricing, item.product.id); if (!line) return null; return <div key={item.product.id}>{image ? <img src={image} alt="" /> : <span className="order-confirm-placeholder" />}<div><strong>{item.product.name}</strong><small>{line.quantity} × {formatVnd(line.unitPrice)}{line.freeQuantity > 0 ? ` · ${copy.freeItems(line.freeQuantity)}` : ""}</small></div><b>{formatVnd(line.total)}</b></div>; })}</div>
              {pricing.discountAmount > 0 && <div className="order-confirm-discount"><span>{copy.discount}</span><strong>−{formatVnd(pricing.discountAmount)}</strong></div>}
              <div className="order-confirm-total"><span>{copy.total}</span><strong>{formatVnd(totalAmount)}</strong></div>
            </div>
            <div className="order-confirm-side">
              <label className="order-confirm-name"><span>{copy.pickupName}</span><div><UserRound size={18} /><input type="text" placeholder={copy.pickupPlaceholder} value={customerName} aria-invalid={Boolean(customerNameError) || undefined} aria-describedby={customerNameError ? "pickup-name-error" : undefined} onChange={(event) => { setCustomerName(event.target.value); if (customerNameError) setCustomerNameError(""); }} maxLength={30} autoFocus /></div>{customerNameError ? <small className="order-confirm-name-error" id="pickup-name-error" role="alert">{customerNameError}</small> : <small>{copy.pickupHint}</small>}</label>
              <div className="order-confirm-secure"><ShieldCheck size={17} /><span>{copy.secureCheck}</span></div>
              {!paymentReady && <p className="order-confirm-payment-error" role="alert">{copy.paymentSettingsError}</p>}
              <div className="order-confirm-actions"><button type="button" className="button button-secondary" onClick={onClose} disabled={isSubmitting}>{copy.keepShopping}</button><button type="submit" className="button button-primary" disabled={isSubmitting || checkoutCart.length === 0 || !paymentReady}>{isSubmitting ? <><Loader2 size={16} className="spin-icon" /> {copy.checking}</> : copy.createPay}</button></div>
            </div>
          </form>
          )}
        </Modal>
      </>
    );
  }

  return (
    <>
    <Modal title={copy.scanPay} isOpen={isOpen} onClose={onClose} className="payment-modal payment-qr-modal-redesign checkout-flow-modal" mobileSheet closeLabel={copy.closeModal}>
      <div className="payment-qr-layout">
        <div className="payment-qr-pane">
          <div className="payment-qr-heading"><span>{copy.payNow}</span><strong>{formatVnd(order.total_amount)}</strong><small>{copy.exactNote}</small></div>
          <div className="qr-display payment-qr-display">
          {qrSrc && !isGenerating ? (
            canGenerateVietQr(payment) ? (
              <div className="vietqr-card">
                <div className="vietqr-card-header">
                  <img
                    src={`${import.meta.env.BASE_URL}brand/vietqr.png`}
                    alt="VietQR"
                    className="vietqr-card-logo"
                  />
                </div>

                <div className="vietqr-card-qr">
                  <img src={qrSrc} alt={copy.paymentQrAlt} className="vietqr-qr-img" />
                  <div className="vietqr-center-logo">
                    <img
                      src={centerLogoUrl}
                      alt="Booth logo"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `${import.meta.env.BASE_URL}brand/matsuri-mark.svg`;
                      }}
                    />
                  </div>
                </div>

                <div className="vietqr-card-brands">
                  <span className="vietqr-brand-logo vietqr-napas-brand">
                    <img
                      src={`${import.meta.env.BASE_URL}brand/napas.png`}
                      alt="Napas 247"
                      className="vietqr-napas-logo"
                      onError={(event) => {
                        event.currentTarget.hidden = true;
                        const fallback = event.currentTarget.nextElementSibling;
                        if (fallback instanceof HTMLElement) fallback.hidden = false;
                      }}
                    />
                    <span className="vietqr-brand-fallback" hidden>NAPAS 247</span>
                  </span>
                  <span className="vietqr-divider" />
                  {selectedBank ? (
                    <span className="vietqr-bank-icon">
                      <img
                        src={getBankLogoUrl(selectedBank)}
                        alt={bankName}
                        onError={(event) => {
                          event.currentTarget.hidden = true;
                        }}
                      />
                      <span className="vietqr-bank-name">{selectedBank.name}</span>
                    </span>
                  ) : (
                    <span className="vietqr-bank-text">{bankName}</span>
                  )}
                </div>

                <div className="vietqr-card-details">
                  <span className="vietqr-acc-name">{payment.bank_account_name || "N/A"}</span>
                  <span className="vietqr-acc-number">{payment.bank_account_no || "N/A"}</span>
                  {order.total_amount > 0 && (
                    <span className="vietqr-amount">
                      {copy.amountLabel}: {formatVnd(order.total_amount)}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <img src={qrSrc} alt={copy.paymentQrAlt} className="payment-qr-image" />
            )
          ) : qrUnavailable ? (
            <div className="payment-qr-unavailable" role="status"><CloudOff size={28} /><span>{copy.qrUnavailable}</span></div>
          ) : (
            <PaymentQrLoading label={copy.preparingQr} />
          )}
          </div>

          <div className="payment-status-footer">
            <div className={`payment-waiting-pill ${order.source === "offline_event" && connectionState === "online" ? "is-event" : `is-${connectionState}`}`}>
              {connectionState === "offline" ? <CloudOff size={14} /> : connectionState === "error" ? <CircleAlert size={14} /> : order.source === "offline_event" ? <ShieldCheck size={14} /> : <Loader2 size={14} className="spin-icon" />}
              <span>{connectionState === "offline" && order.source !== "offline_event" ? copy.offlineOrder : connectionState === "error" ? copy.orderStatusError : connectionState === "reconnecting" ? copy.reconnectingOrder : order.source === "offline_event" ? copy.offlineEventOrder : copy.waitingConfirmation}</span>
              {(connectionState === "error" || connectionState === "reconnecting") && (
                <button type="button" className="payment-status-retry" onClick={() => void checkout.refreshOrder()}>
                  {copy.retryOrderStatus}
                </button>
              )}
            </div>
            <p className="payment-reservation-copy">
              {order.source === "offline_event" ? (
                <strong>{copy.offlineEventReserved}</strong>
              ) : (
                <>
                  <strong>{copy.reservedFor(`${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`)}</strong>
                  <br />{copy.reservedWhilePaying}
                </>
              )}
            </p>
            <p className="payment-recovery-copy">{copy.orderRecoverySaved}</p>
          </div>
        </div>

        <div className="payment-receipt payment-receipt-redesign">
          <div className="payment-order-identity"><div><span>{copy.orderCode}</span><strong>{order.order_code}</strong></div>{order.customer_name && <div><span>{copy.pickupName}</span><strong>{order.customer_name}</strong></div>}</div>
          <div className="payment-transfer-card"><span>{copy.transferTo}</span><div><small>{copy.accountName}</small><strong>{payment.bank_account_name || "N/A"}</strong></div><div><small>{copy.accountNumber}</small><button type="button" aria-label={copy.copyAccountNumber} onClick={() => void copyAccountNumber()}><strong>{payment.bank_account_no || "N/A"}</strong><Copy size={14} /></button><span className="payment-copy-feedback" aria-live="polite">{copyFeedback}</span></div><div><small>{copy.bank}</small><strong>{bankName}</strong></div><div className="payment-transfer-note"><small>{copy.transferNote}</small><strong>{order.order_code}</strong></div></div>
          <div className="payment-receipt-items"><span>{copy.orderSummary}</span>{checkoutCart.map((item) => { const line = getPricingLine(pricing, item.product.id); if (!line) return null; return <div key={item.product.id}><span>{line.quantity} × {item.product.name}{line.freeQuantity > 0 ? ` · ${copy.freeItems(line.freeQuantity)}` : ""}</span>{totalAmount === order.total_amount && <strong>{formatVnd(line.total)}</strong>}</div>; })}{pricing.discountAmount > 0 && <div className="payment-receipt-discount"><span>{copy.discount}</span><strong>−{formatVnd(pricing.discountAmount)}</strong></div>}<div className="payment-receipt-total"><span>{copy.total}</span><strong>{formatVnd(order.total_amount)}</strong></div></div>
          {payment.payment_instructions.trim() && <div className="receipt-instructions"><Sparkles size={16} /><span>{payment.payment_instructions}</span></div>}
          <button type="button" className="payment-hide-order" onClick={onClose}>{copy.hidePayment}</button>
          <button type="button" className="button button-secondary" onClick={() => setIsCancelConfirmOpen(true)} disabled={isCancelling || (connectionState === "offline" && order.source !== "offline_event")}>{isCancelling ? copy.cancelling : copy.cancelOrder}</button>
        </div>
      </div>
    </Modal>
    <Modal
      title={copy.cancelReservationTitle}
      isOpen={isCancelConfirmOpen}
      onClose={() => setIsCancelConfirmOpen(false)}
      className="payment-modal cancel-order-modal"
      mobileSheet
      closeLabel={copy.closeModal}
    >
      <div className="payment-success-state payment-cancelled-state cancel-order-confirmation">
        <div className="success-icon-wrap"><Ban size={38} /></div>
        <span className="payment-success-eyebrow">{copy.orderCode} {order.order_code}</span>
        <h2>{copy.cancelReservationTitle}</h2>
        <p>{copy.cancelReservationHint}</p>
        <div className="cancel-order-actions">
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
            className="button button-danger"
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
