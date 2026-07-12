import { useCallback, useEffect, useState } from "react";
import type { CartItem, Product } from "../types/catalog";
import { loadCart, saveCart } from "../lib/offline";

export function usePersistentCart(shopKey?: string) {
  const [cart, setCart] = useState<CartItem[]>(() => loadCart(shopKey));

  useEffect(() => { setCart(loadCart(shopKey)); }, [shopKey]);
  useEffect(() => { saveCart(cart, shopKey); }, [cart, shopKey]);

  const reconcileCart = useCallback((products: Product[]) => {
    setCart((current) => current
      .map((item) => {
        const product = products.find((candidate) => candidate.id === item.product.id);
        if (!product || product.quantity_available <= 0) return null;
        return { product, quantity: Math.min(item.quantity, product.quantity_available) };
      })
      .filter((item): item is CartItem => item !== null));
  }, []);

  return { cart, setCart, reconcileCart };
}
