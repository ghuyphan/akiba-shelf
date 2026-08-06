import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Order } from "../../types/catalog";

const mocks = vi.hoisted(() => ({
  listOfflineEventOrders: vi.fn(),
  loadAdminOrdersSnapshot: vi.fn(),
  loadOfflineEventSession: vi.fn(),
  offlineEventOrderAsOrder: vi.fn(),
}));

vi.mock("../../lib/offline/adminOffline", () => ({
  loadAdminOrdersSnapshot: mocks.loadAdminOrdersSnapshot,
}));
vi.mock("../../lib/offline/offlineEvents", () => ({
  listOfflineEventOrders: mocks.listOfflineEventOrders,
  loadOfflineEventSession: mocks.loadOfflineEventSession,
  offlineEventOrderAsOrder: mocks.offlineEventOrderAsOrder,
}));

import {
  loadOfflineAdminOrderCounts,
  loadOfflineAdminOrderPage,
} from "./adminOrdersOffline";

function order(id: string, overrides: Partial<Order> = {}): Order {
  const now = new Date().toISOString();
  return {
    id,
    order_code: id,
    customer_name: "Customer",
    total_amount: 1000,
    status: "pending",
    created_at: now,
    updated_at: now,
    expires_at: null,
    confirmed_at: null,
    cancelled_at: null,
    expired_at: null,
    ...overrides,
  };
}

describe("adminOrdersOffline", () => {
  beforeEach(() => {
    mocks.loadAdminOrdersSnapshot.mockReturnValue([]);
    mocks.loadOfflineEventSession.mockResolvedValue(null);
    mocks.listOfflineEventOrders.mockResolvedValue([]);
  });

  it("keeps cached Event orders when the local ledger is unavailable", async () => {
    mocks.loadAdminOrdersSnapshot.mockImplementation(
      (_userId: string, _shopId: string, source: string) =>
        source === "event" ? [order("cached")] : [],
    );
    mocks.loadOfflineEventSession.mockRejectedValue(new Error("indexeddb"));

    const result = await loadOfflineAdminOrderPage({
      userId: "user-1",
      shopId: "shop-1",
      filter: "event",
      selectedEventId: "",
      todayOnly: true,
      page: 1,
      pageSize: 12,
    });

    expect(result.orders.map(({ id }) => id)).toEqual(["cached"]);
  });

  it("deduplicates cached and local Event orders for aggregate counts", async () => {
    const cached = order("shared", { source: "offline_event" });
    const local = order("shared", {
      source: "offline_event",
      status: "confirmed",
    });
    mocks.loadAdminOrdersSnapshot.mockImplementation(
      (_userId: string, _shopId: string, source: string) =>
        source === "event" ? [cached] : [],
    );
    mocks.loadOfflineEventSession.mockResolvedValue({ id: "event-1" });
    mocks.listOfflineEventOrders.mockResolvedValue([{ id: "shared" }]);
    mocks.offlineEventOrderAsOrder.mockReturnValue(local);

    const result = await loadOfflineAdminOrderCounts({
      userId: "user-1",
      shopId: "shop-1",
      todayOnly: true,
    });

    expect(result.eventCount).toBe(1);
  });
});
