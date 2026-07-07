import { useEffect, useState } from "react";
import { Banknote, QrCode } from "lucide-react";
import type { PaymentSettings, Product } from "../../types/catalog";
import { formatVnd } from "../../lib/format";
import { getBankLogoUrl, getPaymentBank } from "../../lib/banks";
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
  const bank = getPaymentBank(payment.bank_code, payment.bank_acq_id);

  return (
    <Modal title={title} isOpen={isOpen} onClose={onClose} className="payment-modal">
      <div className="qr-modal-layout">
        <div className="qr-display">
          {qrSrc && !isGenerating ? <img src={qrSrc} alt="Payment QR code" /> : <div className="qr-loading" />}
        </div>
        <div className="qr-copy">
          <div className="qr-icon">
            {canGenerateVietQr(payment) ? <Banknote size={28} /> : <QrCode size={28} />}
          </div>
          <h3>{product ? formatVnd(product.price_vnd) : "Scan to Pay"}</h3>
          {product && <strong className="qr-item-name">{product.name}</strong>}
          {bank && (
            <div className="qr-bank-line">
              <img
                src={getBankLogoUrl(bank)}
                alt=""
                onError={(event) => {
                  event.currentTarget.src = getBankLogoUrl();
                }}
              />
              <span>
                <strong>{bank.name}</strong>
                <small>{bank.full_name}</small>
              </span>
            </div>
          )}
          {payment.bank_account_name && <p className="qr-account">{payment.bank_account_name}</p>}
          <p>{payment.payment_instructions}</p>
        </div>
      </div>
    </Modal>
  );
}
