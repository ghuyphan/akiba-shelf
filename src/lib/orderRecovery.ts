import type { CartItem, Order } from "../types/catalog";
import { safeUuid } from "./id";
import { isCartItem } from "./offline";
import { z } from "zod";
import { orderSchema, productRowSchema } from "./schemas";

const ACTIVE_ORDER_KEY = "akiba-shelf-active-order-v1";
const MAX_ORDER_AGE_MS = 24 * 60 * 60 * 1000;

export type ActiveOrderRecovery = {
  clientRequestId: string;
  recoveryToken: string;
  order: Order | null;
  cart: CartItem[];
  customerName: string;
  startedAt: string;
};

const recoverySchema = z.object({
  clientRequestId: z.string().uuid(), recoveryToken: z.string().min(32), order: orderSchema.nullable(),
  cart: z.array(z.object({ product: productRowSchema, quantity: z.number().int().positive() })), customerName: z.string(), startedAt: z.string().datetime(),
});

export function createOrderRecovery(cart: CartItem[], customerName: string): ActiveOrderRecovery {
  return {
    clientRequestId: safeUuid(),
    recoveryToken: `${safeUuid()}${safeUuid().replace(/-/g, "")}`,
    order: null,
    cart,
    customerName,
    startedAt: new Date().toISOString(),
  };
}

export function loadOrderRecovery(): ActiveOrderRecovery | null {
  try {
    const raw = window.localStorage.getItem(ACTIVE_ORDER_KEY);
    if (!raw) return null;
    const result = recoverySchema.safeParse(JSON.parse(raw));
    if (!result.success) { clearOrderRecovery(); return null; }
    const parsed = result.data as ActiveOrderRecovery;
    const startedAt = new Date(parsed.startedAt).getTime();
    if (!parsed.cart.every(isCartItem) || !Number.isFinite(startedAt) || Date.now() - startedAt > MAX_ORDER_AGE_MS) {
      clearOrderRecovery();
      return null;
    }
    return parsed;
  } catch {
    clearOrderRecovery();
    return null;
  }
}

export function saveOrderRecovery(recovery: ActiveOrderRecovery) {
  window.localStorage.setItem(ACTIVE_ORDER_KEY, JSON.stringify(recovery));
}

export function clearOrderRecovery() {
  window.localStorage.removeItem(ACTIVE_ORDER_KEY);
}
