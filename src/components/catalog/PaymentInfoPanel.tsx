import { CircleHelp } from "lucide-react";
import type { PaymentSettings } from "../../types/catalog";

type PaymentInfoPanelProps = {
  payment: PaymentSettings;
  onOpenPayment: () => void;
};

export function PaymentInfoPanel({ payment, onOpenPayment }: PaymentInfoPanelProps) {
  const qrPreview = payment.momo_qr_url || payment.bank_qr_url;

  return (
    <aside className="info-card payment-card">
      <div className="payment-card-header">
        <h2>Pay with MoMo</h2>
        <strong>momo</strong>
      </div>
      <button className="payment-flow" type="button" aria-label="Open payment QR" onClick={onOpenPayment}>
        {qrPreview ? <img src={qrPreview} alt="Payment QR preview" /> : <div className="payment-qr-placeholder" />}
        <ol>
          <li>
            <span>1</span>
            <strong>Scan the QR</strong>
            <small>Open MoMo app and scan</small>
          </li>
          <li>
            <span>2</span>
            <strong>Confirm amount</strong>
            <small>Check the payment details</small>
          </li>
          <li>
            <span>3</span>
            <strong>Show code to staff</strong>
            <small>Present the code to pick up</small>
          </li>
        </ol>
      </button>
      <button className="how-button" type="button" onClick={onOpenPayment}>
        <CircleHelp size={16} />
        How it works
      </button>
    </aside>
  );
}
