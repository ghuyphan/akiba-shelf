import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { CartItem, Product } from "../../types/catalog";
import { loadCart, saveCart } from "../../lib/offline/offline";
import { getProductPrice } from "../../utils/pricing";

export type CartReconciliationNotice = {
  removed: number;
  quantityAdjusted: number;
  priceChanged: number;
};

export function usePersistentCart(shopKey?: string) {
  const [cart, setCartState] = useState<CartItem[]>(() => loadCart(shopKey));
  const cartRef = useRef(cart);
  const [reconciliationNotice, setReconciliationNotice] =
    useState<CartReconciliationNotice | null>(null);

  const setCart = useCallback<Dispatch<SetStateAction<CartItem[]>>>((next) => {
    setCartState((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      cartRef.current = resolved;
      return resolved;
    });
  }, []);

  useEffect(() => {
    const next = loadCart(shopKey);
    cartRef.current = next;
    setCartState(next);
    setReconciliationNotice(null);
  }, [shopKey]);
  useEffect(() => { saveCart(cart, shopKey); }, [cart, shopKey]);

  const reconcileCart = useCallback((products: Product[], authoritativeIds?: string[]) => {
    const productsById = new Map(products.map((product) => [product.id, product]));
    const checkedIds = new Set(authoritativeIds ?? productsById.keys());
    const notice: CartReconciliationNotice = {
      removed: 0,
      quantityAdjusted: 0,
      priceChanged: 0,
    };
    const next = cartRef.current
      .map((item) => {
        if (!checkedIds.has(item.product.id)) return item;
        const product = productsById.get(item.product.id);
        if (!product || product.quantity_available <= 0) {
          notice.removed += 1;
          return null;
        }
        const rewardQuantity = Math.min(item.reward_quantity ?? 0, product.quantity_available);
        const quantity = Math.min(item.quantity, Math.max(0, product.quantity_available - rewardQuantity));
        if (quantity + rewardQuantity <= 0) {
          notice.removed += 1;
          return null;
        }
        if (
          quantity !== item.quantity ||
          rewardQuantity !== (item.reward_quantity ?? 0)
        ) {
          notice.quantityAdjusted += 1;
        }
        if (getProductPrice(product) !== getProductPrice(item.product)) {
          notice.priceChanged += 1;
        }
        return { product, quantity, reward_quantity: rewardQuantity };
      })
      .filter((item): item is CartItem => item !== null);
    cartRef.current = next;
    setCartState(next);
    if (notice.removed || notice.quantityAdjusted || notice.priceChanged) {
      setReconciliationNotice(notice);
    }
  }, []);

  const clearReconciliationNotice = useCallback(
    () => setReconciliationNotice(null),
    [],
  );

  return {
    cart,
    setCart,
    reconcileCart,
    reconciliationNotice,
    clearReconciliationNotice,
  };
}
