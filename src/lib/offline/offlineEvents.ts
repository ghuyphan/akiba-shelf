import type {
  CartItem,
  OfflineEventOrder,
  OfflineEventPaymentMethod,
  OfflineEventPaymentState,
  OfflineEventSession,
  OfflineEventSyncAcknowledgement,
  Order,
} from "../../types/catalog";
import { safeUuid } from "../../utils/id";
import { calculateCartPricing, getPricingLine } from "../../utils/pricing";

const DB_NAME = "matsuri-offline-events-v1";
const DB_VERSION = 1;
const SESSION_STORE = "sessions";
const ORDER_STORE = "orders";
const LEGACY_SESSION_PREFIX = "matsuri-offline-event-session-v1";
const LEGACY_ORDER_PREFIX = "matsuri-offline-event-orders-v1";
const DEVICE_KEY = "matsuri-offline-event-device-v1";
const UPDATE_CHANNEL = "matsuri-offline-event-updates-v1";
export const OFFLINE_EVENT_UPDATED = "matsuri:offline-event-updated";

export class OfflineEventStorageUnavailableError extends Error {
  constructor() {
    super("Offline Event Mode storage could not be read on this device.");
    this.name = "OfflineEventStorageUnavailableError";
  }
}

export function isOfflineEventStorageUnavailableError(
  error: unknown,
): error is OfflineEventStorageUnavailableError {
  return error instanceof OfflineEventStorageUnavailableError;
}

type LedgerState = {
  session: OfflineEventSession | null;
  orders: OfflineEventOrder[];
};

type LedgerMutation<T> = (state: LedgerState) => {
  session: OfflineEventSession;
  orders: OfflineEventOrder[];
  result: T;
};

type OfflineEventLedger = {
  getSession: (shopId: string) => Promise<OfflineEventSession | null>;
  getSessions: () => Promise<OfflineEventSession[]>;
  getOrders: (sessionId: string) => Promise<OfflineEventOrder[]>;
  mutate: <T>(
    shopId: string,
    sessionId: string,
    mutation: LedgerMutation<T>,
  ) => Promise<T>;
};

let updateChannel: BroadcastChannel | null = null;
let ledgerOverride: OfflineEventLedger | null = null;

function normalizeOrder(order: OfflineEventOrder): OfflineEventOrder {
  const status = order.status;
  return {
    ...order,
    clientRevision:
      Number.isInteger(order.clientRevision) && order.clientRevision > 0
        ? order.clientRevision
        : 1,
    fulfillmentStatus:
      order.fulfillmentStatus ??
      (status === "confirmed" ? "preparing" : "unfulfilled"),
    confirmedAt:
      order.confirmedAt ??
      (status === "confirmed" ? order.updatedAt : undefined),
    cancelledAt:
      order.cancelledAt ??
      (status === "cancelled" ? order.updatedAt : undefined),
  };
}

function sortOrders(orders: OfflineEventOrder[]) {
  return orders
    .map(normalizeOrder)
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
}

function dispatchUpdated(shopId: string) {
  window.dispatchEvent(
    new CustomEvent(OFFLINE_EVENT_UPDATED, { detail: { shopId } }),
  );
}

function getUpdateChannel() {
  if (!("BroadcastChannel" in window)) return null;
  if (!updateChannel) {
    updateChannel = new BroadcastChannel(UPDATE_CHANNEL);
    updateChannel.addEventListener("message", (event) => {
      const shopId = (event.data as { shopId?: unknown } | null)?.shopId;
      if (typeof shopId === "string") dispatchUpdated(shopId);
    });
  }
  return updateChannel;
}

function notifyUpdated(shopId: string) {
  dispatchUpdated(shopId);
  getUpdateChannel()?.postMessage({ shopId });
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

function openDatabase(): Promise<IDBDatabase> {
  if (!("indexedDB" in window))
    return Promise.reject(
      new Error("Offline Event Mode requires IndexedDB on this device."),
    );
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
    request.onblocked = () =>
      reject(new Error("Offline Event storage is busy in another tab."));
  });
}

const indexedDbLedger: OfflineEventLedger = {
  async getSession(shopId) {
    const database = await openDatabase();
    const transaction = database.transaction(SESSION_STORE, "readonly");
    return ((await requestResult(
      transaction.objectStore(SESSION_STORE).get(shopId),
    )) ?? null) as OfflineEventSession | null;
  },
  async getSessions() {
    const database = await openDatabase();
    const transaction = database.transaction(SESSION_STORE, "readonly");
    return requestResult<OfflineEventSession[]>(
      transaction.objectStore(SESSION_STORE).getAll(),
    );
  },
  async getOrders(sessionId) {
    const database = await openDatabase();
    const transaction = database.transaction(ORDER_STORE, "readonly");
    return sortOrders(
      await requestResult<OfflineEventOrder[]>(
        transaction
          .objectStore(ORDER_STORE)
          .index("sessionId")
          .getAll(sessionId),
      ),
    );
  },
  async mutate<T>(
    shopId: string,
    sessionId: string,
    mutation: LedgerMutation<T>,
  ) {
    const database = await openDatabase();
    const transaction = database.transaction(
      [SESSION_STORE, ORDER_STORE],
      "readwrite",
    );
    const sessions = transaction.objectStore(SESSION_STORE);
    const orders = transaction.objectStore(ORDER_STORE);
    const [session, currentOrders] = await Promise.all([
      requestResult<OfflineEventSession | undefined>(sessions.get(shopId)),
      requestResult<OfflineEventOrder[]>(
        orders.index("sessionId").getAll(sessionId),
      ),
    ]);
    const next = mutation({
      session: session ?? null,
      orders: sortOrders(currentOrders),
    });
    sessions.put(next.session);
    next.orders.forEach((order) => orders.put(order));
    await transactionDone(transaction);
    return next.result;
  },
};

function ledger() {
  return ledgerOverride ?? indexedDbLedger;
}

export function useMemoryOfflineEventLedgerForTests({
  getSessionsError,
}: { getSessionsError?: Error } = {}) {
  const sessions = new Map<string, OfflineEventSession>();
  const orders = new Map<string, OfflineEventOrder>();
  let queue = Promise.resolve();
  const memory: OfflineEventLedger = {
    async getSession(shopId) {
      return sessions.get(shopId) ?? null;
    },
    async getSessions() {
      if (getSessionsError) throw getSessionsError;
      return [...sessions.values()];
    },
    async getOrders(sessionId) {
      return sortOrders(
        [...orders.values()].filter((order) => order.sessionId === sessionId),
      );
    },
    mutate<T>(shopId: string, sessionId: string, mutation: LedgerMutation<T>) {
      const operation = queue.then(() => {
        const next = mutation({
          session: sessions.get(shopId) ?? null,
          orders: sortOrders(
            [...orders.values()].filter(
              (order) => order.sessionId === sessionId,
            ),
          ),
        });
        sessions.set(shopId, next.session);
        next.orders.forEach((order) => orders.set(order.id, order));
        return next.result;
      });
      queue = operation.then(
        () => undefined,
        () => undefined,
      );
      return operation;
    },
  };
  ledgerOverride = memory;
  return () => {
    if (ledgerOverride === memory) ledgerOverride = null;
  };
}

function legacySessionKey(shopId: string) {
  return `${LEGACY_SESSION_PREFIX}:${shopId}`;
}

function legacyOrdersKey(sessionId: string) {
  return `${LEGACY_ORDER_PREFIX}:${sessionId}`;
}

async function migrateLegacySession(session: OfflineEventSession) {
  const rawOrders = JSON.parse(
    localStorage.getItem(legacyOrdersKey(session.id)) || "[]",
  ) as OfflineEventOrder[];
  await ledger().mutate(session.shopId, session.id, () => ({
    session,
    orders: sortOrders(rawOrders),
    result: undefined,
  }));
  localStorage.removeItem(legacySessionKey(session.shopId));
  localStorage.removeItem(legacyOrdersKey(session.id));
  return session;
}

export async function assertOfflineEventStorageAvailable() {
  await ledger().getSessions();
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

export async function saveOfflineEventSession(session: OfflineEventSession) {
  await ledger().mutate(session.shopId, session.id, (state) => ({
    session,
    orders: state.orders,
    result: undefined,
  }));
  notifyUpdated(session.shopId);
}

export async function mergeRecoveredOfflineEventSession(
  recovered: OfflineEventSession,
) {
  const merged = await ledger().mutate(
    recovered.shopId,
    recovered.id,
    (state) => {
      if (state.session && state.session.id !== recovered.id) {
        return {
          session: state.session,
          orders: state.orders,
          result: state.session,
        };
      }
      const soldByProduct = new Map<string, number>();
      state.orders
        .filter((order) => order.status !== "cancelled")
        .forEach((order) =>
          order.items.forEach((item) =>
            soldByProduct.set(
              item.product_id,
              (soldByProduct.get(item.product_id) ?? 0) + item.quantity,
            ),
          ),
        );
      const localAllocations = new Map(
        state.session?.allocations.map((allocation) => [
          allocation.product.id,
          allocation,
        ]) ?? [],
      );
      const session: OfflineEventSession = {
        ...recovered,
        status: state.session?.status ?? recovered.status,
        allocations: recovered.allocations.map((allocation) => ({
          ...allocation,
          quantitySold: Math.max(
            allocation.quantitySold,
            localAllocations.get(allocation.product.id)?.quantitySold ?? 0,
            soldByProduct.get(allocation.product.id) ?? 0,
          ),
        })),
        updatedAt:
          state.session && state.session.updatedAt > recovered.updatedAt
            ? state.session.updatedAt
            : recovered.updatedAt,
      };
      return { session, orders: state.orders, result: session };
    },
  );
  notifyUpdated(recovered.shopId);
  return merged;
}

export async function loadOfflineEventSession(shopId: string) {
  try {
    const stored = await ledger().getSession(shopId);
    if (stored?.version === 1) return stored;
    const legacy = JSON.parse(
      localStorage.getItem(legacySessionKey(shopId)) || "null",
    ) as OfflineEventSession | null;
    return legacy?.version === 1 ? await migrateLegacySession(legacy) : null;
  } catch {
    return null;
  }
}

export async function loadOfflineEventSessionBySlug(shopSlug: string) {
  try {
    const stored = (await ledger().getSessions()).find(
      (session) => session.shopSlug === shopSlug && session.status === "active",
    );
    if (stored) return stored;
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(`${LEGACY_SESSION_PREFIX}:`)) continue;
      const legacy = JSON.parse(
        localStorage.getItem(key) || "null",
      ) as OfflineEventSession | null;
      if (legacy?.shopSlug === shopSlug && legacy.status === "active")
        return migrateLegacySession(legacy);
    }
    return null;
  } catch {
    throw new OfflineEventStorageUnavailableError();
  }
}

export async function listOfflineEventOrders(sessionId: string) {
  try {
    return await ledger().getOrders(sessionId);
  } catch {
    return [];
  }
}

export async function getOfflineEventSignOutRisk() {
  try {
    const sessions = await ledger().getSessions();
    let unsyncedOrderCount = 0;
    for (const session of sessions.filter(
      (candidate) => candidate.status !== "closed",
    )) {
      const orders = await ledger().getOrders(session.id);
      unsyncedOrderCount += orders.filter((order) => !order.syncedAt).length;
    }
    const activeSessionCount = sessions.filter(
      (session) => session.status === "active" || session.status === "closing",
    ).length;
    return activeSessionCount || unsyncedOrderCount
      ? { activeSessionCount, unsyncedOrderCount }
      : null;
  } catch {
    throw new Error(
      "Offline Event storage could not be checked. Keep this account signed in and retry after storage access is restored.",
    );
  }
}

function requireActiveSession(
  stored: OfflineEventSession | null,
  expected: OfflineEventSession,
) {
  if (
    !stored ||
    stored.id !== expected.id ||
    stored.deviceId !== expected.deviceId
  )
    throw new Error("Offline event session is no longer available.");
  if (stored.status !== "active")
    throw new Error("Offline event is closing or closed.");
  return stored;
}

function localOrderCode() {
  return `EVT-${safeUuid().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export async function createOfflineEventOrder(
  session: OfflineEventSession,
  cart: CartItem[],
  customerName: string,
  paymentMethod: OfflineEventPaymentMethod = "vietqr",
) {
  const result = await ledger().mutate(session.shopId, session.id, (state) => {
    const currentSession = requireActiveSession(state.session, session);
    const pricing = calculateCartPricing(cart, currentSession.promotion);
    const quantities = new Map(
      cart.map((item) => [
        item.product.id,
        item.quantity + (item.reward_quantity ?? 0),
      ]),
    );
    const nextSession: OfflineEventSession = {
      ...currentSession,
      allocations: currentSession.allocations.map((allocation) => {
        const requested = quantities.get(allocation.product.id) ?? 0;
        if (requested > allocation.quantityAllocated - allocation.quantitySold)
          throw new Error(
            `${allocation.product.name} no longer has enough event stock.`,
          );
        return {
          ...allocation,
          quantitySold: allocation.quantitySold + requested,
        };
      }),
      updatedAt: new Date().toISOString(),
    };
    for (const productId of quantities.keys()) {
      if (
        !currentSession.allocations.some(
          (item) => item.product.id === productId,
        )
      )
        throw new Error(
          "One or more items are not allocated to this event device.",
        );
    }
    const now = new Date().toISOString();
    const order: OfflineEventOrder = {
      version: 1,
      id: safeUuid(),
      sessionId: currentSession.id,
      shopId: currentSession.shopId,
      orderCode: localOrderCode(),
      customerName: customerName.trim(),
      totalAmount: pricing.total,
      status: "pending",
      paymentMethod,
      paymentState: "awaiting_payment",
      clientRevision: 1,
      fulfillmentStatus: "unfulfilled",
      items: cart.map((item) => {
        const line = getPricingLine(pricing, item.product.id);
        return {
          product_id: item.product.id,
          quantity: item.quantity + (item.reward_quantity ?? 0),
          unit_price:
            line?.unitPrice ??
            item.product.effective_price_vnd ??
            item.product.price_vnd,
          discount_amount: line ? Math.max(0, line.subtotal - line.total) : 0,
        };
      }),
      createdAt: now,
      updatedAt: now,
    };
    return {
      session: nextSession,
      orders: [...state.orders, order],
      result: order,
    };
  });
  notifyUpdated(session.shopId);
  return result;
}

export async function updateOfflineEventOrder(
  session: OfflineEventSession,
  orderId: string,
  next: {
    status: "confirmed" | "cancelled";
    paymentState: OfflineEventPaymentState;
  },
) {
  const result = await ledger().mutate(session.shopId, session.id, (state) => {
    const currentSession = requireActiveSession(state.session, session);
    const current = state.orders.find((order) => order.id === orderId);
    if (!current) throw new Error("Offline order not found.");
    if (current.status === "confirmed" && next.status !== "confirmed")
      throw new Error("Confirmed offline orders cannot be changed.");
    if (current.status === "cancelled")
      throw new Error("Cancelled offline orders cannot be reopened.");
    const now = new Date().toISOString();
    const updated: OfflineEventOrder = {
      ...current,
      status: next.status,
      paymentState: next.paymentState,
      clientRevision: current.clientRevision + 1,
      fulfillmentStatus:
        next.status === "confirmed"
          ? current.fulfillmentStatus === "unfulfilled"
            ? "preparing"
            : current.fulfillmentStatus
          : "unfulfilled",
      fulfillmentUpdatedAt:
        next.status === "confirmed" &&
        current.fulfillmentStatus === "unfulfilled"
          ? now
          : current.fulfillmentUpdatedAt,
      confirmedAt:
        next.status === "confirmed"
          ? (current.confirmedAt ?? now)
          : current.confirmedAt,
      cancelledAt:
        next.status === "cancelled"
          ? (current.cancelledAt ?? now)
          : current.cancelledAt,
      confirmedByLabel:
        next.status === "confirmed"
          ? `Event device ${currentSession.deviceId.slice(0, 8)}`
          : current.confirmedByLabel,
      cancelledByLabel:
        next.status === "cancelled"
          ? `Event device ${currentSession.deviceId.slice(0, 8)}`
          : current.cancelledByLabel,
      updatedAt: now,
      syncedAt: undefined,
    };
    const nextSession =
      next.status === "cancelled"
        ? {
            ...currentSession,
            allocations: currentSession.allocations.map((allocation) => {
              const item = current.items.find(
                (candidate) => candidate.product_id === allocation.product.id,
              );
              return item
                ? {
                    ...allocation,
                    quantitySold: Math.max(
                      0,
                      allocation.quantitySold - item.quantity,
                    ),
                  }
                : allocation;
            }),
            updatedAt: now,
          }
        : currentSession;
    return {
      session: nextSession,
      orders: state.orders.map((order) =>
        order.id === orderId ? updated : order,
      ),
      result: { session: nextSession, order: updated },
    };
  });
  notifyUpdated(session.shopId);
  return result;
}

export async function updateOfflineEventOrderFulfillment(
  session: OfflineEventSession,
  orderId: string,
  nextStatus: "ready" | "picked_up",
) {
  const result = await ledger().mutate(session.shopId, session.id, (state) => {
    const currentSession = requireActiveSession(state.session, session);
    const current = state.orders.find((order) => order.id === orderId);
    if (!current) throw new Error("Offline order not found.");
    if (current.status !== "confirmed")
      throw new Error("Confirm payment before updating fulfilment.");
    const ranks = { unfulfilled: 0, preparing: 1, ready: 2, picked_up: 3 };
    if (ranks[nextStatus] < ranks[current.fulfillmentStatus])
      throw new Error("Fulfilment cannot move backward.");
    if (nextStatus === current.fulfillmentStatus)
      return {
        session: currentSession,
        orders: state.orders,
        result: current,
      };
    const now = new Date().toISOString();
    const updated: OfflineEventOrder = {
      ...current,
      clientRevision: current.clientRevision + 1,
      fulfillmentStatus: nextStatus,
      fulfillmentUpdatedAt: now,
      fulfillmentUpdatedByLabel: `Event device ${currentSession.deviceId.slice(0, 8)}`,
      updatedAt: now,
      syncedAt: undefined,
    };
    return {
      session: currentSession,
      orders: state.orders.map((order) =>
        order.id === orderId ? updated : order,
      ),
      result: updated,
    };
  });
  notifyUpdated(session.shopId);
  return result;
}

export async function markOfflineEventOrdersSynced(
  session: OfflineEventSession,
  acknowledgements: OfflineEventSyncAcknowledgement[],
) {
  if (!acknowledgements.length) return;
  const revisions = new Map(
    acknowledgements.map((item) => [item.id, item.clientRevision]),
  );
  await ledger().mutate(session.shopId, session.id, (state) => {
    const currentSession = state.session;
    if (!currentSession || currentSession.id !== session.id)
      throw new Error("Offline event session is no longer available.");
    const syncedAt = new Date().toISOString();
    return {
      session: currentSession,
      orders: state.orders.map((order) =>
        revisions.get(order.id) === order.clientRevision
          ? { ...order, syncedAt }
          : order,
      ),
      result: undefined,
    };
  });
  notifyUpdated(session.shopId);
}

export async function freezeOfflineEventSession(session: OfflineEventSession) {
  const frozen = await ledger().mutate(session.shopId, session.id, (state) => {
    const current = requireActiveSession(state.session, session);
    const next = {
      ...current,
      status: "closing" as const,
      updatedAt: new Date().toISOString(),
    };
    return { session: next, orders: state.orders, result: next };
  });
  notifyUpdated(session.shopId);
  return frozen;
}

export async function restoreOfflineEventSession(session: OfflineEventSession) {
  const restored = await ledger().mutate(
    session.shopId,
    session.id,
    (state) => {
      if (!state.session || state.session.id !== session.id)
        throw new Error("Offline event session is no longer available.");
      const next = {
        ...state.session,
        status: "active" as const,
        updatedAt: new Date().toISOString(),
      };
      return { session: next, orders: state.orders, result: next };
    },
  );
  notifyUpdated(session.shopId);
  return restored;
}

export async function closeLocalOfflineEvent(session: OfflineEventSession) {
  const closed = await ledger().mutate(session.shopId, session.id, (state) => {
    if (!state.session || state.session.id !== session.id)
      throw new Error("Offline event session is no longer available.");
    const next = {
      ...state.session,
      status: "closed" as const,
      updatedAt: new Date().toISOString(),
    };
    return { session: next, orders: state.orders, result: next };
  });
  notifyUpdated(session.shopId);
  return closed;
}

export function offlineEventOrderAsOrder(
  order: OfflineEventOrder,
  session?: OfflineEventSession,
): Order {
  const normalized = normalizeOrder(order);
  const discountAmount = normalized.items.reduce(
    (total, item) => total + item.discount_amount,
    0,
  );
  return {
    id: normalized.id,
    shop_id: normalized.shopId,
    order_code: normalized.orderCode,
    customer_name: normalized.customerName || null,
    total_amount: normalized.totalAmount,
    discount_amount: discountAmount,
    status: normalized.status,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
    expires_at: null,
    confirmed_at: normalized.confirmedAt ?? null,
    cancelled_at: normalized.cancelledAt ?? null,
    expired_at: null,
    fulfillment_status:
      normalized.status === "confirmed"
        ? normalized.fulfillmentStatus
        : "unfulfilled",
    fulfillment_updated_at: normalized.fulfillmentUpdatedAt ?? null,
    confirmed_by_email: normalized.confirmedByLabel ?? null,
    cancelled_by_email: normalized.cancelledByLabel ?? null,
    fulfillment_updated_by_email: normalized.fulfillmentUpdatedByLabel ?? null,
    source: "offline_event",
    offline_event_session_id: normalized.sessionId,
    offline_event_name: session?.name,
    payment_method: normalized.paymentMethod,
    payment_state: normalized.paymentState,
    order_items: normalized.items.map((item) => {
      const product = session?.allocations.find(
        (allocation) => allocation.product.id === item.product_id,
      )?.product;
      return {
        id: `${normalized.id}:${item.product_id}`,
        order_id: normalized.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount,
        product: product
          ? {
              id: product.id,
              name: product.name,
              item_code: product.item_code,
              images: product.images,
            }
          : undefined,
      };
    }),
  };
}
