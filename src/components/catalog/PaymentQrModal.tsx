import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import type { PaymentSettings, Product } from "../../types/catalog";
import { formatVnd } from "../../lib/format";
import { canGenerateVietQr, generateVietQr } from "../../lib/vietqr";
import { Modal } from "../ui/Modal";

type PaymentQrModalProps = {
  isOpen: boolean;
  payment: PaymentSettings;
  product?: Product;
  onClose: () => void;
};

export function PaymentQrModal({ isOpen, payment, product, onClose }: PaymentQrModalProps) {
  const [qrSrc, setQrSrc] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function loadQr() {
      setIsGenerating(true);
      const generated = await generateVietQr(payment, product).catch(() => null);
      if (!cancelled) {
        setQrSrc(generated?.src || payment.bank_qr_url || payment.momo_qr_url);
        setIsGenerating(false);
      }
    }

    void loadQr();
    return () => {
      cancelled = true;
    };
  }, [isOpen, payment, product]);

  const title = canGenerateVietQr(payment) ? payment.bank_label : payment.momo_label;

  return (
    <Modal title={title} isOpen={isOpen} onClose={onClose} className="payment-modal">
      <div className="qr-modal-layout">
        <div className="qr-display">
          {qrSrc && !isGenerating ? <img src={qrSrc} alt="Payment QR code" /> : <div className="qr-loading" />}
        </div>
        <div className="qr-copy">
          <div className="qr-note">
            <span className="qr-note-kicker">Payment</span>
            <strong>Thank you!</strong>
            <small>Scan the big QR when you are ready.</small>
          </div>
          {product && (
            <div className="qr-total">
              <span>Total</span>
              <strong>{formatVnd(product.price_vnd)}</strong>
              <small>{product.name}</small>
            </div>
          )}
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
