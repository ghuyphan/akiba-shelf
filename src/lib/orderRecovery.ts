import type { CartItem, Order } from "../types/catalog";
import { safeUuid } from "./supabase";

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
    const parsed = JSON.parse(raw) as ActiveOrderRecovery;
    const startedAt = new Date(parsed.startedAt).getTime();
    if (!parsed.clientRequestId || !parsed.recoveryToken || !Array.isArray(parsed.cart) || !Number.isFinite(startedAt) || Date.now() - startedAt > MAX_ORDER_AGE_MS) {
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
