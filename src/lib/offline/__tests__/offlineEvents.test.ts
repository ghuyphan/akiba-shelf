import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OfflineEventSession, Product } from "../../../types/catalog";
import { defaultPromotion } from "../../constants";
import {
  assertOfflineEventStorageAvailable,
  createOfflineEventOrder,
  freezeOfflineEventSession,
  getOfflineEventSignOutRisk,
  getOfflineEventDeviceId,
  listOfflineEventOrders,
  loadOfflineEventSession,
  markOfflineEventOrdersSynced,
  mergeRecoveredOfflineEventSession,
  offlineEventOrderAsOrder,
  restoreOfflineEventSession,
  saveOfflineEventSession,
  updateOfflineEventOrder,
  updateOfflineEventOrderFulfillment,
  useMemoryOfflineEventLedgerForTests,
} from "../offlineEvents";

const product: Product = {
  id: "event-print",
  name: "Event Print",
  collection: "Convention",
  description: "",
  price_vnd: 100_000,
  item_code: "EVT-PRINT",
  quantity_available: 3,
  category: "Prints",
  stock_status: "limited",
  stock_note: "Limited stock",
  images: [],
  featured: false,
  sort_order: 1,
  active: true,
};

function session(): OfflineEventSession {
  const now = new Date().toISOString();
  return {
    version: 1,
    id: "71000000-0000-4000-8000-000000000001",
    shopId: "70000000-0000-4000-8000-000000000001",
    shopSlug: "event-shop",
    deviceId: "72000000-0000-4000-8000-000000000001",
    name: "Convention day",
    status: "active",
    allocations: [{ product, quantityAllocated: 3, quantitySold: 0 }],
    payment: {
      momo_qr_url: "",
      bank_qr_url: "",
      momo_label: "MoMo",
      bank_label: "Bank",
      payment_instructions: "",
    },
    promotion: {
      ...defaultPromotion,
      enabled: false,
      buy_quantity: 3,
      free_quantity: 1,
      repeatable: false,
      qualifying_product_ids: [],
      reward_product_ids: [],
    },
    createdAt: now,
    updatedAt: now,
  };
}

describe("offline event ledger", () => {
  let resetLedger: () => void;

  beforeEach(() => {
    localStorage.clear();
    resetLedger = useMemoryOfflineEventLedgerForTests();
  });

  afterEach(() => resetLedger());

  it("creates a durable local order and consumes only allocated stock", async () => {
    const active = session();
    await saveOfflineEventSession(active);
    const order = await createOfflineEventOrder(
      active,
      [{ product, quantity: 2 }],
      "Customer",
    );

    expect(order).toMatchObject({
      shopId: active.shopId,
      status: "pending",
      totalAmount: 200_000,
      paymentState: "awaiting_payment",
      fulfillmentStatus: "unfulfilled",
    });
    expect(await listOfflineEventOrders(active.id)).toHaveLength(1);
    expect(
      (await loadOfflineEventSession(active.shopId))?.allocations[0],
    ).toMatchObject({ quantityAllocated: 3, quantitySold: 2 });
    expect(offlineEventOrderAsOrder(order, active)).toMatchObject({
      source: "offline_event",
      offline_event_name: "Convention day",
      discount_amount: 0,
      order_items: [
        {
          product_id: product.id,
          quantity: 2,
          product: {
            name: "Event Print",
            item_code: "EVT-PRINT",
          },
        },
      ],
    });
  });

  it("uses the frozen percentage promotion for local Event orders", async () => {
    const active = session();
    active.promotion = {
      ...active.promotion,
      enabled: true,
      kind: "percentage",
      percentage_off: 20,
      qualifying_product_ids: [product.id],
    };
    await saveOfflineEventSession(active);
    const order = await createOfflineEventOrder(
      active,
      [{ product, quantity: 2 }],
      "Customer",
      "cash",
    );
    expect(order.totalAmount).toBe(160_000);
    expect(order.items[0]?.discount_amount).toBe(40_000);
  });

  it("prices local orders from the allocation snapshot, not a stale cart", async () => {
    const active = session();
    active.allocations[0].product = {
      ...product,
      price_vnd: 120_000,
      sale_price_vnd: 90_000,
      effective_price_vnd: 90_000,
    };
    await saveOfflineEventSession(active);

    const order = await createOfflineEventOrder(
      active,
      [
        {
          product: {
            ...product,
            price_vnd: 1,
            sale_price_vnd: 1,
            effective_price_vnd: 1,
          },
          quantity: 2,
        },
      ],
      "Customer",
    );

    expect(order.totalAmount).toBe(180_000);
    expect(order.items).toEqual([
      {
        product_id: product.id,
        quantity: 2,
        unit_price: 90_000,
        discount_amount: 0,
      },
    ]);
  });

  it("blocks sign-out while this device owns event stock or unsynced orders", async () => {
    const active = session();
    await saveOfflineEventSession(active);
    expect(await getOfflineEventSignOutRisk()).toEqual({
      activeSessionCount: 1,
      unsyncedOrderCount: 0,
    });

    const order = await createOfflineEventOrder(
      active,
      [{ product, quantity: 1 }],
      "Customer",
    );
    expect(await getOfflineEventSignOutRisk()).toEqual({
      activeSessionCount: 1,
      unsyncedOrderCount: 1,
    });

    await markOfflineEventOrdersSynced(active, [
      {
        id: order.id,
        clientRevision: order.clientRevision,
      },
    ]);
    expect(await getOfflineEventSignOutRisk()).toEqual({
      activeSessionCount: 1,
      unsyncedOrderCount: 0,
    });
  });

  it("does not block sign-out for a locally closed event", async () => {
    const closed = { ...session(), status: "closed" as const };
    await saveOfflineEventSession(closed);

    expect(await getOfflineEventSignOutRisk()).toBeNull();
  });

  it("fails closed when Event Mode storage cannot be inspected", async () => {
    resetLedger();
    resetLedger = useMemoryOfflineEventLedgerForTests({
      getSessionsError: new Error("IndexedDB unavailable"),
    });

    await expect(getOfflineEventSignOutRisk()).rejects.toThrow(
      /keep this account signed in/i,
    );
  });

  it("fails closed when Event Mode storage cannot be written", async () => {
    resetLedger();
    resetLedger = useMemoryOfflineEventLedgerForTests({
      probeWriteError: new Error("IndexedDB write failed"),
    });

    await expect(assertOfflineEventStorageAvailable()).rejects.toThrow(
      /storage could not be read/i,
    );
  });

  it("discards corrupt legacy orders during migration", async () => {
    const active = session();
    localStorage.setItem(
      `matsuri-offline-event-session-v1:${active.shopId}`,
      JSON.stringify(active),
    );
    localStorage.setItem(
      `matsuri-offline-event-orders-v1:${active.id}`,
      "{not-json",
    );

    expect(await loadOfflineEventSession(active.shopId)).toMatchObject({
      id: active.id,
    });
    expect(await listOfflineEventOrders(active.id)).toEqual([]);
  });

  it("keeps a generated device id stable when storage is blocked", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new DOMException("Storage blocked", "SecurityError");
    });
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("Storage blocked", "SecurityError");
    });

    expect(getOfflineEventDeviceId()).toBe(getOfflineEventDeviceId());
  });

  it("fails closed when local orders cannot be read", async () => {
    resetLedger();
    resetLedger = useMemoryOfflineEventLedgerForTests({
      getOrdersError: new Error("IndexedDB unavailable"),
    });

    await expect(
      listOfflineEventOrders("71000000-0000-4000-8000-000000000001"),
    ).rejects.toThrow(/storage could not be read/i);
  });

  it("rejects malformed persisted orders instead of treating them as empty", async () => {
    resetLedger();
    resetLedger = useMemoryOfflineEventLedgerForTests({
      unsafeOrders: [
        {
          version: 1,
          id: "not-a-valid-order-id",
          sessionId: "71000000-0000-4000-8000-000000000001",
          quantity: -1,
        },
      ],
    });

    await expect(
      listOfflineEventOrders("71000000-0000-4000-8000-000000000001"),
    ).rejects.toThrow(/storage could not be read/i);
  });

  it("preserves a valid empty event ledger", async () => {
    const active = session();
    await saveOfflineEventSession(active);

    await expect(listOfflineEventOrders(active.id)).resolves.toEqual([]);
  });

  it("rejects overselling without mutating the allocation", async () => {
    const active = session();
    await saveOfflineEventSession(active);

    await expect(
      createOfflineEventOrder(active, [{ product, quantity: 4 }], "Customer"),
    ).rejects.toThrow(/enough event stock/i);
    expect(
      (await loadOfflineEventSession(active.shopId))?.allocations[0]
        .quantitySold,
    ).toBe(0);
  });

  it("aggregates duplicate product rows for allocation and cancellation", async () => {
    const active = session();
    await saveOfflineEventSession(active);
    const order = await createOfflineEventOrder(
      active,
      [
        { product, quantity: 1 },
        { product, quantity: 1 },
      ],
      "Customer",
    );

    expect(order.items).toMatchObject([
      { product_id: product.id, quantity: 2 },
    ]);
    expect(
      (await loadOfflineEventSession(active.shopId))?.allocations[0]
        .quantitySold,
    ).toBe(2);

    await updateOfflineEventOrder(active, order.id, {
      status: "cancelled",
      paymentState: "awaiting_payment",
    });
    expect(
      (await loadOfflineEventSession(active.shopId))?.allocations[0]
        .quantitySold,
    ).toBe(0);
  });

  it("rejects duplicate rows whose combined quantity exceeds allocation", async () => {
    const active = session();
    await saveOfflineEventSession(active);

    await expect(
      createOfflineEventOrder(
        active,
        [
          { product, quantity: 2 },
          { product, quantity: 2 },
        ],
        "Customer",
      ),
    ).rejects.toThrow(/enough event stock/i);
    expect(
      (await loadOfflineEventSession(active.shopId))?.allocations[0]
        .quantitySold,
    ).toBe(0);
  });

  it("serializes concurrent sales so allocated stock cannot be oversold", async () => {
    const active = session();
    active.allocations[0].quantityAllocated = 1;
    await saveOfflineEventSession(active);

    const attempts = await Promise.allSettled([
      createOfflineEventOrder(active, [{ product, quantity: 1 }], "First"),
      createOfflineEventOrder(active, [{ product, quantity: 1 }], "Second"),
    ]);

    expect(
      attempts.filter(({ status }) => status === "fulfilled"),
    ).toHaveLength(1);
    expect(attempts.filter(({ status }) => status === "rejected")).toHaveLength(
      1,
    );
    expect(await listOfflineEventOrders(active.id)).toHaveLength(1);
    expect(
      (await loadOfflineEventSession(active.shopId))?.allocations[0],
    ).toMatchObject({ quantityAllocated: 1, quantitySold: 1 });
  });

  it("does not rewind local sold stock when server recovery finishes late", async () => {
    const active = session();
    await saveOfflineEventSession(active);
    await createOfflineEventOrder(
      active,
      [{ product, quantity: 2 }],
      "Customer",
    );

    const recovered = session();
    recovered.updatedAt = new Date(Date.now() - 60_000).toISOString();
    await mergeRecoveredOfflineEventSession(recovered);

    expect(
      (await loadOfflineEventSession(active.shopId))?.allocations[0]
        .quantitySold,
    ).toBe(2);
    expect(await listOfflineEventOrders(active.id)).toHaveLength(1);
  });

  it("returns local allocation when staff cancels a pending order", async () => {
    const active = session();
    await saveOfflineEventSession(active);
    const order = await createOfflineEventOrder(
      active,
      [{ product, quantity: 2 }],
      "Customer",
    );
    const current = (await loadOfflineEventSession(active.shopId))!;

    await updateOfflineEventOrder(current, order.id, {
      status: "cancelled",
      paymentState: "awaiting_payment",
    });

    expect(
      (await loadOfflineEventSession(active.shopId))?.allocations[0]
        .quantitySold,
    ).toBe(0);
    expect((await listOfflineEventOrders(active.id))[0].status).toBe(
      "cancelled",
    );
  });

  it("advances confirmed fulfilment locally without allowing regressions", async () => {
    const active = session();
    await saveOfflineEventSession(active);
    const order = await createOfflineEventOrder(
      active,
      [{ product, quantity: 1 }],
      "Customer",
    );
    await updateOfflineEventOrder(active, order.id, {
      status: "confirmed",
      paymentState: "bank_confirmed",
    });
    const confirmedAt = (await listOfflineEventOrders(active.id))[0]
      .confirmedAt;
    await updateOfflineEventOrderFulfillment(active, order.id, "ready");
    await updateOfflineEventOrderFulfillment(active, order.id, "picked_up");

    const fulfilled = (await listOfflineEventOrders(active.id))[0];
    expect(fulfilled.fulfillmentStatus).toBe("picked_up");
    expect(fulfilled.confirmedAt).toBe(confirmedAt);
    expect(offlineEventOrderAsOrder(fulfilled, active).confirmed_at).toBe(
      confirmedAt,
    );
    expect(fulfilled.syncedAt).toBeUndefined();
    await expect(
      updateOfflineEventOrderFulfillment(active, order.id, "ready"),
    ).rejects.toThrow(/cannot move backward/i);
  });

  it("does not mark a newer local revision synced from a stale acknowledgement", async () => {
    const active = session();
    await saveOfflineEventSession(active);
    const order = await createOfflineEventOrder(
      active,
      [{ product, quantity: 1 }],
      "Customer",
    );

    await updateOfflineEventOrder(active, order.id, {
      status: "confirmed",
      paymentState: "cash_confirmed",
    });
    await markOfflineEventOrdersSynced(active, [
      {
        id: order.id,
        clientRevision: order.clientRevision,
      },
    ]);

    const current = (await listOfflineEventOrders(active.id))[0];
    expect(current.clientRevision).toBe(order.clientRevision + 1);
    expect(current.syncedAt).toBeUndefined();
  });

  it("freezes local sales while closing and can restore them after failure", async () => {
    const active = session();
    await saveOfflineEventSession(active);
    const frozen = await freezeOfflineEventSession(active);

    await expect(
      createOfflineEventOrder(frozen, [{ product, quantity: 1 }], "Blocked"),
    ).rejects.toThrow(/closing or closed/i);

    const restored = await restoreOfflineEventSession(frozen);
    await expect(
      createOfflineEventOrder(restored, [{ product, quantity: 1 }], "Allowed"),
    ).resolves.toMatchObject({ customerName: "Allowed" });
  });
});
