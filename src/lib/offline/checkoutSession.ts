import { z } from "zod";
import type {
  CartItem,
  CheckoutSession,
  CheckoutSessionState,
  Order,
} from "../../types/catalog";
import { safeUuid } from "../../utils/id";
import { orderSchema, productRowSchema } from "../schemas";
import { isCartItem } from "./offline";

const ACTIVE_CHECKOUT_KEY = "akiba-shelf-active-order-v1";
const MAX_CHECKOUT_AGE_MS = 24 * 60 * 60 * 1000;

const checkoutKey = (shopSlug?: string) =>
  shopSlug ? `${ACTIVE_CHECKOUT_KEY}:${shopSlug}` : ACTIVE_CHECKOUT_KEY;

const cartItemSchema = z.object({
  product: productRowSchema,
  quantity: z.number().int().nonnegative(),
  reward_quantity: z.number().int().nonnegative().optional(),
});

const checkoutSessionSchema = z.object({
  version: z.literal(2),
  shopSlug: z.string().min(1),
  clientRequestId: z.string().uuid(),
  recoveryToken: z.string().min(32),
  order: orderSchema.nullable(),
  cart: z.array(cartItemSchema),
  customerName: z.string(),
  state: z.enum([
    "queued",
    "needs_review",
    "reserved",
    "confirmed",
    "cancelled",
    "expired",
  ]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastAttemptAt: z.string().datetime().optional(),
  lastError: z.string().optional(),
  lastErrorCode: z.enum(["offline_event_storage_unavailable"]).optional(),
});

const legacyCheckoutSchema = z.object({
  clientRequestId: z.string().uuid(),
  recoveryToken: z.string().min(32),
  order: orderSchema.nullable(),
  cart: z.array(cartItemSchema),
  customerName: z.string(),
  startedAt: z.string().datetime(),
  offline: z.boolean().optional(),
  offlinePaid: z.boolean().optional(),
  offline_code: z.string().optional(),
});

function stateForOrder(order: Order): CheckoutSessionState {
  return order.status === "pending" ? "reserved" : order.status;
}

function isExpired(createdAt: string) {
  const timestamp = new Date(createdAt).getTime();
  return (
    !Number.isFinite(timestamp) || Date.now() - timestamp > MAX_CHECKOUT_AGE_MS
  );
}

function isValidSession(session: CheckoutSession) {
  if (!session.cart.every(isCartItem) || isExpired(session.createdAt)) return false;
  if (session.state === "queued" || session.state === "needs_review")
    return session.order === null;
  return session.order !== null;
}

function migrateLegacyCheckout(
  value: unknown,
  shopSlug: string,
): CheckoutSession | null {
  const parsed = legacyCheckoutSchema.safeParse(value);
  if (!parsed.success || isExpired(parsed.data.startedAt)) return null;

  const syntheticOrder =
    parsed.data.offline === true ||
    parsed.data.order?.order_code.startsWith("OFF-") === true;
  const order = syntheticOrder ? null : (parsed.data.order as Order | null);
  const now = new Date().toISOString();
  const session: CheckoutSession = {
    version: 2,
    shopSlug,
    clientRequestId: parsed.data.clientRequestId,
    recoveryToken: parsed.data.recoveryToken,
    order,
    cart: parsed.data.cart as CartItem[],
    customerName: parsed.data.customerName,
    state: order ? stateForOrder(order as Order) : "queued",
    createdAt: parsed.data.startedAt,
    updatedAt: now,
    lastError: syntheticOrder
      ? "This checkout was saved offline. Reconnect to verify stock and reserve the items."
      : undefined,
  };
  return isValidSession(session) ? session : null;
}

export function createCheckoutSession(
  shopSlug: string,
  cart: CartItem[],
  customerName: string,
): CheckoutSession {
  const now = new Date().toISOString();
  return {
    version: 2,
    shopSlug,
    clientRequestId: safeUuid(),
    recoveryToken: `${safeUuid()}${safeUuid().replace(/-/g, "")}`,
    order: null,
    cart,
    customerName,
    state: "queued",
    createdAt: now,
    updatedAt: now,
  };
}

export function loadCheckoutSession(shopSlug: string): CheckoutSession | null {
  try {
    const key = checkoutKey(shopSlug);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as unknown;
    const current = checkoutSessionSchema.safeParse(value);
    const session = current.success
      ? (current.data as CheckoutSession)
      : migrateLegacyCheckout(value, shopSlug);
    if (!session || !isValidSession(session)) {
      clearCheckoutSession(shopSlug);
      return null;
    }
    if (!current.success) saveCheckoutSession(session);
    return session;
  } catch {
    clearCheckoutSession(shopSlug);
    return null;
  }
}

export function saveCheckoutSession(session: CheckoutSession) {
  window.localStorage.setItem(
    checkoutKey(session.shopSlug),
    JSON.stringify(session),
  );
}

export function clearCheckoutSession(shopSlug: string) {
  window.localStorage.removeItem(checkoutKey(shopSlug));
}
