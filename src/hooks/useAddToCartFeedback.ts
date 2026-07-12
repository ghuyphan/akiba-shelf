import { useCallback, useEffect, useRef, useState } from "react";
import { safeUuid } from "../lib/id";
import type { Product } from "../types/catalog";

export type FlyingItem = {
  id: string;
  imageUrl: string;
  startX: number;
  startY: number;
  tx: number;
  ty: number;
  tyHalf: number;
  mobile: boolean;
};

export function useAddToCartFeedback(lightweightMode: boolean) {
  const [flyingItems, setFlyingItems] = useState<FlyingItem[]>([]);
  const timersRef = useRef<number[]>([]);

  const schedule = useCallback((action: () => void, delay: number) => {
    const timer = window.setTimeout(action, delay);
    timersRef.current.push(timer);
  }, []);

  useEffect(() => () => timersRef.current.forEach((timer) => window.clearTimeout(timer)), []);

  const animateAdd = useCallback((product: Product, event: React.MouseEvent) => {
    if (lightweightMode) return;

    const trigger = event.currentTarget as HTMLElement;
    trigger.classList.remove("is-adding-to-cart");
    void trigger.offsetWidth;
    trigger.classList.add("is-adding-to-cart");
    schedule(() => trigger.classList.remove("is-adding-to-cart"), 560);

    if (!window.matchMedia("(max-width: 760px)").matches) {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        const cartSurface = document.querySelector<HTMLElement>(".selected-panel:not(.selected-panel-empty)");
        if (!cartSurface) return;
        cartSurface.classList.remove("cart-just-updated");
        void cartSurface.offsetWidth;
        cartSurface.classList.add("cart-just-updated");
        schedule(() => cartSurface.classList.remove("cart-just-updated"), 560);
      }));
    }

    const imageUrl = product.image_variants?.[0]?.thumbnail || product.images[0] || "";
    const startX = event.clientX;
    const startY = event.clientY;
    const id = safeUuid();
    const mobile = window.matchMedia("(max-width: 760px)").matches;

    const startFlight = () => {
      const target = document.querySelector<HTMLElement>(mobile ? ".mobile-cart-summary-icon-wrap" : ".storefront-module-cart .selected-panel");
      const rect = target?.getBoundingClientRect();
      const targetX = rect ? rect.left + rect.width / 2 : mobile ? 40 : window.innerWidth - 180;
      const targetY = rect ? rect.top + rect.height / 2 : mobile ? window.innerHeight - 40 : 250;
      const tx = targetX - startX;
      const ty = targetY - startY;
      setFlyingItems((current) => [...current, { id, imageUrl, startX, startY, tx, ty, tyHalf: Math.min(ty * .42, -76), mobile }]);

      if (mobile && target) schedule(() => {
        target.classList.remove("cart-icon-landing");
        void target.offsetWidth;
        target.classList.add("cart-icon-landing");
        schedule(() => target.classList.remove("cart-icon-landing"), 360);
      }, 390);

      schedule(() => setFlyingItems((current) => current.filter((item) => item.id !== id)), 800);
    };

    if (mobile) window.requestAnimationFrame(() => window.requestAnimationFrame(startFlight));
    else startFlight();
  }, [lightweightMode, schedule]);

  return { flyingItems, animateAdd };
}
