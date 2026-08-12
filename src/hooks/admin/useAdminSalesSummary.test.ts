import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Order, SalesSummary } from "../../types/catalog";

const mocks = vi.hoisted(() => ({
  getSalesSummary: vi.fn(),
  isSessionNoise: vi.fn(),
  listOfflineEventOrders: vi.fn(),
  loadAdminOrdersSnapshot: vi.fn(),
  loadOfflineEventSession: vi.fn(),
  offlineEventOrderAsOrder: vi.fn(),
}));

vi.mock("../../lib/api/sales", () => ({
  getSalesSummary: mocks.getSalesSummary,
}));
vi.mock("../../lib/errors", () => ({
  isSessionNoise: mocks.isSessionNoise,
}));
vi.mock("../../lib/offline/adminOffline", () => ({
  loadAdminOrdersSnapshot: mocks.loadAdminOrdersSnapshot,
}));
vi.mock("../../lib/offline/offlineEvents", () => ({
  listOfflineEventOrders: mocks.listOfflineEventOrders,
  loadOfflineEventSession: mocks.loadOfflineEventSession,
  offlineEventOrderAsOrder: mocks.offlineEventOrderAsOrder,
  OFFLINE_EVENT_UPDATED: "matsuri:offline-event-updated",
}));

import { useAdminSalesSummary } from "./useAdminSalesSummary";

function order(id: string, overrides: Partial<Order> = {}): Order {
  // Keep fixtures clearly inside the hook's exclusive upper time bound.
  const now = new Date(Date.now() - 1_000).toISOString();
  return {
    id,
    order_code: id,
    customer_name: "Customer",
    total_amount: 1000,
    status: "confirmed",
    source: "offline_event",
    created_at: now,
    updated_at: now,
    expires_at: null,
    confirmed_at: now,
    cancelled_at: null,
    expired_at: null,
    ...overrides,
  };
}

function summary(overrides: Partial<SalesSummary> = {}): SalesSummary {
  return {
    from: new Date(0).toISOString(),
    to: new Date().toISOString(),
    revenue: 0,
    discount_amount: 0,
    confirmed_order_count: 0,
    units_sold: 0,
    online_revenue: 0,
    event_revenue: 0,
    cash_revenue: 0,
    vietqr_revenue: 0,
    product_breakdown: [],
    ...overrides,
  };
}

describe("useAdminSalesSummary", () => {
  beforeEach(() => {
    mocks.getSalesSummary.mockResolvedValue(summary());
    mocks.isSessionNoise.mockReturnValue(false);
    mocks.loadOfflineEventSession.mockResolvedValue(null);
    mocks.listOfflineEventOrders.mockResolvedValue([]);
    mocks.loadAdminOrdersSnapshot.mockReturnValue([]);
  });

  it("bounds all-history reporting to the server-supported window", async () => {
    renderHook(() =>
      useAdminSalesSummary({
        enabled: true,
        ready: true,
        shopId: "shop-1",
        userId: "user-1",
        todayOnly: false,
      }),
    );

    await waitFor(() => expect(mocks.getSalesSummary).toHaveBeenCalled());
    const [, from, to] = mocks.getSalesSummary.mock.calls[0] as [
      string,
      string,
      string,
    ];
    expect(new Date(to).getTime() - new Date(from).getTime()).toBe(
      366 * 24 * 60 * 60 * 1000,
    );
  });

  it("marks unsynced confirmed Event revenue as provisional", async () => {
    const localOrder = order("local-1");
    mocks.loadOfflineEventSession.mockResolvedValue({ id: "event-1" });
    mocks.listOfflineEventOrders.mockResolvedValue([
      { id: "local-1", status: "confirmed" },
    ]);
    mocks.offlineEventOrderAsOrder.mockReturnValue(localOrder);

    const { result } = renderHook(() =>
      useAdminSalesSummary({
        enabled: true,
        ready: true,
        shopId: "shop-1",
        userId: "user-1",
        todayOnly: false,
      }),
    );

    await waitFor(() =>
      expect(result.current.sales.status).toBe("provisional"),
    );
    expect(result.current.sales.summary?.event_revenue).toBe(1000);
  });

  it("projects cached orders when authoritative sales fail", async () => {
    mocks.getSalesSummary.mockRejectedValue(new Error("offline"));
    const cachedOrder = order("cached", {
      source: "online",
      total_amount: 2500,
    });
    mocks.loadAdminOrdersSnapshot.mockImplementation(
      (_userId: string, _shopId: string, source: string) =>
        source === "online" ? [cachedOrder] : [],
    );

    const { result } = renderHook(() =>
      useAdminSalesSummary({
        enabled: true,
        ready: true,
        shopId: "shop-1",
        userId: "user-1",
        todayOnly: false,
      }),
    );

    await waitFor(() => expect(result.current.sales.status).toBe("fallback"));
    expect(result.current.sales.summary?.online_revenue).toBe(2500);
  });
});
