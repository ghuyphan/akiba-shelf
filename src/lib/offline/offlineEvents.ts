import type {
  CartItem,
  OfflineEventOrder,
  OfflineEventPaymentMethod,
  OfflineEventPaymentState,
  OfflineEventSession,
  Order,
} from "../../types/catalog";
import { safeUuid } from "../../utils/id";
import { calculateCartPricing, getPricingLine } from "../../utils/pricing";

const DB_NAME = "matsuri-offline-events-v1";
const DB_VERSION = 1;
const SESSION_STORE = "sessions";
const ORDER_STORE = "orders";
const FALLBACK_SESSION_PREFIX = "matsuri-offline-event-session-v1";
const FALLBACK_ORDER_PREFIX = "matsuri-offline-event-orders-v1";
const DEVICE_KEY = "matsuri-offline-event-device-v1";
export const OFFLINE_EVENT_UPDATED = "matsuri:offline-event-updated";

type StoreName = typeof SESSION_STORE | typeof ORDER_STORE;

function notifyUpdated(shopId: string) {
  window.dispatchEvent(
    new CustomEvent(OFFLINE_EVENT_UPDATED, { detail: { shopId } }),
  );
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (!("indexedDB" in window)) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SESSION_STORE))
        database.createObjectStore(SESSION_STORE, { keyPath: "shopId" });
      if (!database.objectStoreNames.contains(ORDER_STORE)) {
        const orders = database.createObjectStore(ORDER_STORE, {
          keyPath: "id",
        });
        orders.createIndex("sessionId", "sessionId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function fallbackSessionKey(shopId: string) {
  return `${FALLBACK_SESSION_PREFIX}:${shopId}`;
}

function fallbackOrdersKey(sessionId: string) {
  return `${FALLBACK_ORDER_PREFIX}:${sessionId}`;
}

export function getOfflineEventDeviceId() {
  const stored = localStorage.getItem(DEVICE_KEY);
  if (stored) return stored;
  const id = safeUuid();
  localStorage.setItem(DEVICE_KEY, id);
  return id;
}

export async function requestDurableOfflineStorage() {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

async function getValue<T>(storeName: StoreName, key: IDBValidKey) {
  const database = await openDatabase();
  if (!database) return undefined;
  const transaction = database.transaction(storeName, "readonly");
  return requestResult(
    transaction.objectStore(storeName).get(key) as IDBRequest<T | undefined>,
  );
}

export async function saveOfflineEventSession(session: OfflineEventSession) {
  const database = await openDatabase();
  if (database) {
    const transaction = database.transaction(SESSION_STORE, "readwrite");
    transaction.objectStore(SESSION_STORE).put(session);
    await transactionDone(transaction);
  } else {
    localStorage.setItem(fallbackSessionKey(session.shopId), JSON.stringify(session));
  }
  notifyUpdated(session.shopId);
}

export async function loadOfflineEventSession(
  shopId: string,
): Promise<OfflineEventSession | null> {
  try {
    const stored = await getValue<OfflineEventSession>(SESSION_STORE, shopId);
    if (stored?.version === 1) return stored;
    const fallback = JSON.parse(
      localStorage.getItem(fallbackSessionKey(shopId)) || "null",
    ) as OfflineEventSession | null;
    return fallback?.version === 1 ? fallback : null;
  } catch {
    return null;
  }
}

export async function loadOfflineEventSessionBySlug(
  shopSlug: string,
): Promise<OfflineEventSession | null> {
  try {
    const database = await openDatabase();
    if (database) {
      const transaction = database.transaction(SESSION_STORE, "readonly");
      const sessions = await requestResult<OfflineEventSession[]>(
        transaction.objectStore(SESSION_STORE).getAll(),
      );
      return (
        sessions.find(
          (session) =>
            session.shopSlug === shopSlug && session.status === "active",
        ) ?? null
      );
    }
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(`${FALLBACK_SESSION_PREFIX}:`)) continue;
      const session = JSON.parse(
        localStorage.getItem(key) || "null",
      ) as OfflineEventSession | null;
      if (session?.shopSlug === shopSlug && session.status === "active")
        return session;
    }
    return null;
  } catch {
    return null;
  }
}

export async function listOfflineEventOrders(sessionId: string) {
  try {
    const database = await openDatabase();
    if (database) {
      const transaction = database.transaction(ORDER_STORE, "readonly");
      const orders = await requestResult<OfflineEventOrder[]>(
        transaction.objectStore(ORDER_STORE).index("sessionId").getAll(sessionId),
      );
      return orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    const orders = JSON.parse(
      localStorage.getItem(fallbackOrdersKey(sessionId)) || "[]",
    ) as OfflineEventOrder[];
    return orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

function localOrderCode() {
  return `EVT-${safeUuid().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export async function createOfflineEventOrder(
  session: OfflineEventSession,
  cart: CartItem[],
  customerName: string,
  paymentMethod: OfflineEventPaymentMethod = "vietqr",
): Promise<OfflineEventOrder> {
  if (session.status !== "active") throw new Error("Offline event is closed.");
  const pricing = calculateCartPricing(cart, session.promotion);
  const quantities = new Map(
    cart.map((item) => [
      item.product.id,
      item.quantity + (item.reward_quantity ?? 0),
    ]),
  );
  const nextSession: OfflineEventSession = {
    ...session,
    allocations: session.allocations.map((allocation) => {
      const requested = quantities.get(allocation.product.id) ?? 0;
      if (requested > allocation.quantityAllocated - allocation.quantitySold)
        throw new Error(`${allocation.product.name} no longer has enough event stock.`);
      return {
        ...allocation,
        quantitySold: allocation.quantitySold + requested,
      };
    }),
    updatedAt: new Date().toISOString(),
  };
  for (const productId of quantities.keys()) {
    if (!session.allocations.some((item) => item.product.id === productId))
      throw new Error("One or more items are not allocated to this event device.");
  }
  const now = new Date().toISOString();
  const order: OfflineEventOrder = {
    version: 1,
    id: safeUuid(),
    sessionId: session.id,
    shopId: session.shopId,
    orderCode: localOrderCode(),
    customerName: customerName.trim(),
    totalAmount: pricing.total,
    status: "pending",
    paymentMethod,
    paymentState: "awaiting_payment",
    items: cart.map((item) => {
      const line = getPricingLine(pricing, item.product.id);
      const quantity = item.quantity + (item.reward_quantity ?? 0);
      return {
        product_id: item.product.id,
        quantity,
        unit_price: line?.unitPrice ?? item.product.effective_price_vnd ?? item.product.price_vnd,
        discount_amount: line ? Math.max(0, line.subtotal - line.total) : 0,
      };
    }),
    createdAt: now,
    updatedAt: now,
  };

  const database = await openDatabase();
  if (database) {
    const transaction = database.transaction(
      [SESSION_STORE, ORDER_STORE],
      "readwrite",
    );
    transaction.objectStore(SESSION_STORE).put(nextSession);
    transaction.objectStore(ORDER_STORE).put(order);
    await transactionDone(transaction);
  } else {
    const orders = await listOfflineEventOrders(session.id);
    localStorage.setItem(fallbackSessionKey(session.shopId), JSON.stringify(nextSession));
    localStorage.setItem(
      fallbackOrdersKey(session.id),
      JSON.stringify([...orders, order]),
    );
  }
  notifyUpdated(session.shopId);
  return order;
}

export async function updateOfflineEventOrder(
  session: OfflineEventSession,
  orderId: string,
  next: {
    status: "confirmed" | "cancelled";
    paymentState: OfflineEventPaymentState;
  },
) {
  const orders = await listOfflineEventOrders(session.id);
  const current = orders.find((order) => order.id === orderId);
  if (!current) throw new Error("Offline order not found.");
  if (current.status === "confirmed" && next.status !== "confirmed")
    throw new Error("Confirmed offline orders cannot be changed.");
  if (current.status === "cancelled")
    throw new Error("Cancelled offline orders cannot be reopened.");
  const updated: OfflineEventOrder = {
    ...current,
    status: next.status,
    paymentState: next.paymentState,
    updatedAt: new Date().toISOString(),
    syncedAt: undefined,
  };
  const nextSession =
    next.status === "cancelled"
      ? {
          ...session,
          allocations: session.allocations.map((allocation) => {
            const item = current.items.find(
              (candidate) => candidate.product_id === allocation.product.id,
            );
            return item
              ? {
                  ...allocation,
                  quantitySold: Math.max(0, allocation.quantitySold - item.quantity),
                }
              : allocation;
          }),
          updatedAt: new Date().toISOString(),
        }
      : session;

  const database = await openDatabase();
  if (database) {
    const transaction = database.transaction(
      [SESSION_STORE, ORDER_STORE],
      "readwrite",
    );
    transaction.objectStore(SESSION_STORE).put(nextSession);
    transaction.objectStore(ORDER_STORE).put(updated);
    await transactionDone(transaction);
  } else {
    localStorage.setItem(fallbackSessionKey(session.shopId), JSON.stringify(nextSession));
    localStorage.setItem(
      fallbackOrdersKey(session.id),
      JSON.stringify(orders.map((order) => (order.id === orderId ? updated : order))),
    );
  }
  notifyUpdated(session.shopId);
  return { session: nextSession, order: updated };
}

export async function markOfflineEventOrdersSynced(
  session: OfflineEventSession,
  orders: OfflineEventOrder[],
) {
  const syncedAt = new Date().toISOString();
  const updated = orders.map((order) => ({ ...order, syncedAt }));
  const database = await openDatabase();
  if (database) {
    const transaction = database.transaction(ORDER_STORE, "readwrite");
    updated.forEach((order) => transaction.objectStore(ORDER_STORE).put(order));
    await transactionDone(transaction);
  } else {
    localStorage.setItem(fallbackOrdersKey(session.id), JSON.stringify(updated));
  }
  notifyUpdated(session.shopId);
}

export async function closeLocalOfflineEvent(session: OfflineEventSession) {
  await saveOfflineEventSession({
    ...session,
    status: "closed",
    updatedAt: new Date().toISOString(),
  });
}

export function offlineEventOrderAsOrder(order: OfflineEventOrder): Order {
  return {
    id: order.id,
    shop_id: order.shopId,
    order_code: order.orderCode,
    customer_name: order.customerName || null,
    total_amount: order.totalAmount,
    status: order.status,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
    expires_at: null,
    confirmed_at: order.status === "confirmed" ? order.updatedAt : null,
    cancelled_at: order.status === "cancelled" ? order.updatedAt : null,
    expired_at: null,
    source: "offline_event",
    offline_event_session_id: order.sessionId,
    payment_method: order.paymentMethod,
    payment_state: order.paymentState,
  };
}
