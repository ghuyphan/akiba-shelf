import { useCallback, useEffect, useState } from "react";
import type { CartItem, Product } from "../types/catalog";
import { loadCart, saveCart } from "../lib/offline/offline";

export function usePersistentCart(shopKey?: string) {
  const [cart, setCart] = useState<CartItem[]>(() => loadCart(shopKey));

  useEffect(() => { setCart(loadCart(shopKey)); }, [shopKey]);
  useEffect(() => { saveCart(cart, shopKey); }, [cart, shopKey]);

  const reconcileCart = useCallback((products: Product[], authoritativeIds?: string[]) => {
    const productsById = new Map(products.map((product) => [product.id, product]));
    const checkedIds = new Set(authoritativeIds ?? productsById.keys());
    setCart((current) => current
      .map((item) => {
        if (!checkedIds.has(item.product.id)) return item;
        const product = productsById.get(item.product.id);
        if (!product || product.quantity_available <= 0) return null;
        const rewardQuantity = Math.min(item.reward_quantity ?? 0, product.quantity_available);
        const quantity = Math.min(item.quantity, Math.max(0, product.quantity_available - rewardQuantity));
        if (quantity + rewardQuantity <= 0) return null;
        return { product, quantity, reward_quantity: rewardQuantity };
      })
      .filter((item): item is CartItem => item !== null));
  }, []);

  return { cart, setCart, reconcileCart };
}
