import { BadgeCheck, CreditCard, QrCode } from "lucide-react";

const steps = [
  { icon: QrCode, label: "Scan item QR" },
  { icon: CreditCard, label: "Pay MoMo or cash" },
  { icon: BadgeCheck, label: "Pick up at booth" },
];

export function CheckoutGuide() {
  return (
    <section className="checkout-guide" aria-label="Checkout steps">
      {steps.map(({ icon: Icon, label }) => (
        <div className="checkout-step" key={label}>
          <Icon size={18} />
          <span>{label}</span>
        </div>
      ))}
    </section>
  );
}
