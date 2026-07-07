import { useEffect, useMemo, useState } from "react";
import { Banknote, CheckCircle2, ReceiptText, Sparkles } from "lucide-react";
import type { PaymentSettings, Product } from "../../types/catalog";
import { formatVnd } from "../../lib/format";
import { canGenerateVietQr, generateVietQr } from "../../lib/vietqr";
import { Modal } from "../ui/Modal";

type PaymentQrModalProps = {
  isOpen: boolean;
  payment: PaymentSettings;
  product?: Product;
  quantity: number;
  onClose: () => void;
};

export function PaymentQrModal({ isOpen, payment, product, quantity, onClose }: PaymentQrModalProps) {
  const [qrSrc, setQrSrc] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const paymentProduct = useMemo(
    () => (product ? { ...product, price_vnd: product.price_vnd * quantity } : undefined),
    [product, quantity],
  );

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function loadQr() {
      setIsGenerating(true);
      const generated = await generateVietQr(payment, paymentProduct).catch(() => null);
      if (!cancelled) {
        setQrSrc(generated?.src || payment.bank_qr_url || payment.momo_qr_url);
        setIsGenerating(false);
      }
    }

    void loadQr();
    return () => {
      cancelled = true;
    };
  }, [isOpen, payment, paymentProduct]);

  const title = canGenerateVietQr(payment) ? payment.bank_label : payment.momo_label;

  return (
    <Modal title={title} isOpen={isOpen} onClose={onClose} className="payment-modal">
      <div className="qr-modal-layout">
        <div className="qr-display">
          {qrSrc && !isGenerating ? <img src={qrSrc} alt="Payment QR code" /> : <div className="qr-loading" />}
        </div>
        <div className="qr-copy">
          <div className="qr-note">
            <CheckCircle2 size={22} />
            <span>
              <strong>Thank you!</strong>
              <small>Scan the QR when you are ready.</small>
            </span>
          </div>
          {product && (
            <div className="qr-total">
              <ReceiptText size={22} />
              <span>
                <small>Total</small>
                <strong>{formatVnd(product.price_vnd * quantity)}</strong>
                <em>
                  {quantity} x {product.name}
                </em>
              </span>
            </div>
          )}
          <div className="qr-total">
            <Banknote size={22} />
            <span>
              <small>Payment</small>
              <strong>{title}</strong>
              <em>{payment.bank_account_name || payment.bank_account_no || "Show this QR to staff after transfer."}</em>
            </span>
          </div>
          {payment.payment_instructions && (
            <p className="qr-instructions">
              <Sparkles size={15} />
              {payment.payment_instructions}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
