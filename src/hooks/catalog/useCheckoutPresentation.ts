import { useEffect, useState } from "react";
import {
  generateVietQrForCart,
  getPaymentQrFallbackUrl,
} from "../../utils/vietqr";
import type { CartItem, Order, PaymentSettings } from "../../types/catalog";

export function usePaymentQrSource(isOpen: boolean, order: Order | null, payment: PaymentSettings, cart: CartItem[]) {
  const [source, setSource] = useState("");
  const [generating, setGenerating] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!isOpen || !order) {
      setSource("");
      setGenerating(false);
      setUnavailable(false);
      return;
    }
    let cancelled = false;
    setGenerating(true);
    setUnavailable(false);
    void generateVietQrForCart(payment, cart, order.order_code, order.total_amount)
      .catch(() => null)
      .then((generated: { src: string } | null) => {
        if (cancelled) return;
        const nextSource = generated?.src || getPaymentQrFallbackUrl(payment);
        setSource(nextSource);
        setUnavailable(!nextSource);
        setGenerating(false);
      });
    return () => { cancelled = true; };
  }, [cart, isOpen, order, payment]);

  return { qrSrc: source, isGenerating: generating, qrUnavailable: unavailable };
}

export function useOrderCountdown(order: Order | null, onExpired: () => void) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!order?.expires_at || order.status !== "pending") { setRemaining(0); return; }
    const update = () => setRemaining(Math.max(0, Math.ceil((new Date(order.expires_at!).getTime() - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [order?.expires_at, order?.status]);

  useEffect(() => {
    if (order?.status === "pending" && remaining === 0 && order.expires_at) onExpired();
  }, [onExpired, order?.expires_at, order?.status, remaining]);

  return remaining;
}
