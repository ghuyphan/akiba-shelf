import { beforeEach, describe, expect, it } from "vitest";
import type { OfflineEventSession, Product } from "../../../types/catalog";
import {
  createOfflineEventOrder,
  listOfflineEventOrders,
  loadOfflineEventSession,
  saveOfflineEventSession,
  updateOfflineEventOrder,
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
  beforeEach(() => localStorage.clear());

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
    });
    expect(await listOfflineEventOrders(active.id)).toHaveLength(1);
    expect((await loadOfflineEventSession(active.shopId))?.allocations[0])
      .toMatchObject({ quantityAllocated: 3, quantitySold: 2 });
  });

  it("rejects overselling without mutating the allocation", async () => {
    const active = session();
    await saveOfflineEventSession(active);

    await expect(
      createOfflineEventOrder(
        active,
        [{ product, quantity: 4 }],
        "Customer",
      ),
    ).rejects.toThrow(/enough event stock/i);
    expect((await loadOfflineEventSession(active.shopId))?.allocations[0].quantitySold)
      .toBe(0);
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

    expect((await loadOfflineEventSession(active.shopId))?.allocations[0].quantitySold)
      .toBe(0);
    expect((await listOfflineEventOrders(active.id))[0].status).toBe("cancelled");
  });
});
