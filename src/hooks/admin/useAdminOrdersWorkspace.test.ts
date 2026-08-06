import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Order } from "../../types/catalog";

const mocks = vi.hoisted(() => ({
  getOfflineEventOrders: vi.fn(),
  getOrders: vi.fn(),
  getOrderStatusCounts: vi.fn(),
  getSalesSummary: vi.fn(),
  isTransportError: vi.fn(),
  listOfflineEventOrders: vi.fn(),
  loadAdminOrdersSnapshot: vi.fn(),
  loadOfflineEventSession: vi.fn(),
  offlineEventOrderAsOrder: vi.fn(),
  saveAdminOrdersSnapshot: vi.fn(),
  captureRealtimeOptions: vi.fn(),
  scheduleReload: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("../../components/ui/ToastProvider", () => ({
  useToast: () => ({ error: mocks.toastError }),
}));
vi.mock("../../lib/api/offlineEvents", () => ({
  getOfflineEventOrders: mocks.getOfflineEventOrders,
}));
vi.mock("../../lib/api/orders", () => ({
  getOrders: mocks.getOrders,
  getOrderStatusCounts: mocks.getOrderStatusCounts,
}));
vi.mock("../../lib/api/sales", () => ({
  getSalesSummary: mocks.getSalesSummary,
}));
vi.mock("../../lib/errors", () => ({
  getErrorMessage: (_error: unknown, fallback: string) => fallback,
  isSessionNoise: () => false,
  isTransportError: mocks.isTransportError,
}));
vi.mock("../../lib/i18n/platformI18n", () => ({
  usePlatformI18n: () => ({ t: (value: string) => value }),
}));
vi.mock("../../lib/offline/adminOffline", () => ({
  loadAdminOrdersSnapshot: mocks.loadAdminOrdersSnapshot,
  saveAdminOrdersSnapshot: mocks.saveAdminOrdersSnapshot,
}));
vi.mock("../../lib/offline/offlineEvents", () => ({
  listOfflineEventOrders: mocks.listOfflineEventOrders,
  loadOfflineEventSession: mocks.loadOfflineEventSession,
  offlineEventOrderAsOrder: mocks.offlineEventOrderAsOrder,
  OFFLINE_EVENT_UPDATED: "akiba:offline-event-updated",
}));
vi.mock("./useAdminOrderRealtime", () => ({
  useAdminOrderRealtime: (options: unknown) => {
    mocks.captureRealtimeOptions(options);
    return mocks.scheduleReload;
  },
}));

import { useAdminOrdersWorkspace } from "./useAdminOrdersWorkspace";

function order(id: string, overrides: Partial<Order> = {}): Order {
  const now = new Date().toISOString();
  return {
    id,
    order_code: id.toUpperCase(),
    customer_name: "Customer",
    total_amount: 100_000,
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

const emptySalesSummary = {
  from: "2026-08-06T00:00:00.000Z",
  to: "2026-08-07T00:00:00.000Z",
  revenue: 0,
  discount_amount: 0,
  confirmed_order_count: 0,
  units_sold: 0,
  online_revenue: 0,
  event_revenue: 0,
  cash_revenue: 0,
  vietqr_revenue: 0,
  product_breakdown: [],
};

describe("useAdminOrdersWorkspace", () => {
  beforeEach(() => {
    mocks.getOrders.mockResolvedValue({ orders: [], total: 0 });
    mocks.getOrderStatusCounts.mockResolvedValue({
      all: 0,
      pending: 0,
      confirmed: 0,
      cancelled: 0,
      expired: 0,
    });
    mocks.getOfflineEventOrders.mockResolvedValue({ orders: [], total: 0 });
    mocks.loadAdminOrdersSnapshot.mockReturnValue([]);
    mocks.loadOfflineEventSession.mockResolvedValue(null);
    mocks.listOfflineEventOrders.mockResolvedValue([]);
    mocks.isTransportError.mockReturnValue(false);
    mocks.getSalesSummary.mockResolvedValue(emptySalesSummary);
  });

  afterEach(() => vi.clearAllMocks());

  it("deduplicates concurrent manual reloads", async () => {
    const response = deferred<{ orders: Order[]; total: number }>();
    mocks.getOrders.mockReturnValue(response.promise);
    const { result } = renderHook(() =>
      useAdminOrdersWorkspace({
        enabled: true,
        ready: false,
        shopId: "shop-1",
        userId: "user-1",
      }),
    );

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.reload();
      second = result.current.reload();
    });
    expect(mocks.getOrders).toHaveBeenCalledOnce();

    response.resolve({ orders: [order("order-1")], total: 1 });
    await act(async () => Promise.all([first, second]));
    expect(result.current.orders.map(({ id }) => id)).toEqual(["order-1"]);
  });

  it("ignores stale responses and clears loading after a shop change", async () => {
    const response = deferred<{ orders: Order[]; total: number }>();
    mocks.getOrders.mockReturnValue(response.promise);
    const { result, rerender } = renderHook(
      ({ shopId }) =>
        useAdminOrdersWorkspace({
          enabled: true,
          ready: false,
          shopId,
          userId: "user-1",
        }),
      { initialProps: { shopId: "shop-1" } },
    );

    let request!: Promise<void>;
    act(() => {
      request = result.current.reload();
    });
    expect(result.current.ordersLoading).toBe(true);
    rerender({ shopId: "shop-2" });
    await waitFor(() => expect(result.current.ordersLoading).toBe(false));

    response.resolve({ orders: [order("stale-order")], total: 1 });
    await act(async () => request);
    expect(result.current.orders).toEqual([]);
    expect(mocks.saveAdminOrdersSnapshot).not.toHaveBeenCalled();
  });

  it("resets pagination when the order scope changes", () => {
    const { result } = renderHook(() =>
      useAdminOrdersWorkspace({
        enabled: true,
        ready: false,
        shopId: "shop-1",
        userId: "user-1",
      }),
    );

    act(() => result.current.setOrderPage(3));
    act(() => result.current.changeFilter("confirmed"));
    expect(result.current.orderPage).toBe(1);
    expect(result.current.orderFilter).toBe("confirmed");

    act(() => result.current.setOrderPage(4));
    act(() => result.current.selectEvent("event-1"));
    expect(result.current.orderPage).toBe(1);
    expect(result.current.orderFilter).toBe("event");
    expect(result.current.selectedEventId).toBe("event-1");

    act(() => result.current.setOrderPage(2));
    act(() => result.current.changeTodayOnly(false));
    expect(result.current.orderPage).toBe(1);
    expect(result.current.ordersTodayOnly).toBe(false);
  });

  it("merges cached and local Event orders without duplicates offline", async () => {
    const transportError = new Error("offline");
    const cached = order("shared", {
      source: "offline_event",
      offline_event_session_id: "event-1",
    });
    const localShared = order("shared", {
      order_code: "LOCAL-SHARED",
      source: "offline_event",
      offline_event_session_id: "event-1",
    });
    const localOnly = order("local-only", {
      source: "offline_event",
      offline_event_session_id: "event-1",
    });
    mocks.getOfflineEventOrders.mockRejectedValue(transportError);
    mocks.isTransportError.mockImplementation(
      (error: unknown) => error === transportError,
    );
    mocks.loadAdminOrdersSnapshot.mockImplementation(
      (_userId: string, _shopId: string, source: string) =>
        source === "event" ? [cached] : [],
    );
    mocks.loadOfflineEventSession.mockResolvedValue({ id: "event-1" });
    mocks.listOfflineEventOrders.mockResolvedValue([
      { id: "shared" },
      { id: "local-only" },
    ]);
    mocks.offlineEventOrderAsOrder.mockImplementation(
      (value: { id: string }) =>
        value.id === "shared" ? localShared : localOnly,
    );
    const { result } = renderHook(() =>
      useAdminOrdersWorkspace({
        enabled: true,
        ready: false,
        shopId: "shop-1",
        userId: "user-1",
      }),
    );

    act(() => result.current.changeFilter("event"));
    await act(async () => result.current.reload());

    expect(result.current.orders).toHaveLength(2);
    expect(
      result.current.orders.find(({ id }) => id === "shared")?.order_code,
    ).toBe("LOCAL-SHARED");
    expect(result.current.eventOrderCount).toBe(2);
  });

  it("loads the initial page, aggregate counts, and authoritative sales", async () => {
    const pending = order("pending-1");
    mocks.getOrders.mockResolvedValue({ orders: [pending], total: 1 });
    mocks.getOrderStatusCounts.mockResolvedValue({
      all: 4,
      pending: 1,
      confirmed: 2,
      cancelled: 1,
      expired: 0,
    });
    mocks.getOfflineEventOrders.mockResolvedValue({ orders: [], total: 3 });

    const { result } = renderHook(() =>
      useAdminOrdersWorkspace({
        enabled: true,
        ready: true,
        shopId: "shop-1",
        userId: "user-1",
      }),
    );

    await waitFor(() =>
      expect(result.current.orders.map(({ id }) => id)).toEqual(["pending-1"]),
    );
    await waitFor(() => expect(result.current.eventOrderCount).toBe(3));
    await waitFor(() =>
      expect(result.current.sales.status).toBe("authoritative"),
    );
    expect(result.current.orderCounts.all).toBe(4);
    expect(mocks.getSalesSummary).toHaveBeenCalledOnce();
  });

  it("refreshes both orders and sales from the Realtime callback", async () => {
    renderHook(() =>
      useAdminOrdersWorkspace({
        enabled: true,
        ready: false,
        shopId: "shop-1",
        userId: "user-1",
      }),
    );
    const options = mocks.captureRealtimeOptions.mock.calls.at(-1)?.[0] as {
      onRefresh: () => Promise<void>;
    };

    await act(async () => options.onRefresh());

    expect(mocks.getOrders).toHaveBeenCalledOnce();
    expect(mocks.getOrderStatusCounts).toHaveBeenCalledOnce();
    expect(mocks.getSalesSummary).toHaveBeenCalledOnce();
  });

  it("keeps the aggregate Event badge while refreshing one selected event", async () => {
    mocks.getOfflineEventOrders
      .mockResolvedValueOnce({ orders: [order("event-order")], total: 1 })
      .mockResolvedValueOnce({ orders: [], total: 8 });
    mocks.getOrderStatusCounts.mockResolvedValue({
      all: 2,
      pending: 1,
      confirmed: 1,
      cancelled: 0,
      expired: 0,
    });
    const { result } = renderHook(() =>
      useAdminOrdersWorkspace({
        enabled: true,
        ready: false,
        shopId: "shop-1",
        userId: "user-1",
      }),
    );

    act(() => result.current.selectEvent("event-1"));
    await act(async () => result.current.reload(true));

    expect(result.current.orderTotal).toBe(1);
    expect(result.current.eventOrderCount).toBe(8);
    expect(mocks.getOfflineEventOrders).toHaveBeenNthCalledWith(
      1,
      "shop-1",
      expect.objectContaining({ sessionId: "event-1" }),
    );
    expect(mocks.getOfflineEventOrders).toHaveBeenNthCalledWith(
      2,
      "shop-1",
      expect.not.objectContaining({ sessionId: expect.anything() }),
    );
  });

  it("uses cached counts when the aggregate request fails offline", async () => {
    const transportError = new Error("offline");
    mocks.getOrderStatusCounts.mockRejectedValue(transportError);
    mocks.isTransportError.mockImplementation(
      (error: unknown) => error === transportError,
    );
    mocks.loadAdminOrdersSnapshot.mockImplementation(
      (_userId: string, _shopId: string, source: string) =>
        source === "online"
          ? [order("cached-confirmed", { status: "confirmed" })]
          : source === "event"
            ? [order("cached-event", { source: "offline_event" })]
            : [],
    );
    const { result } = renderHook(() =>
      useAdminOrdersWorkspace({
        enabled: true,
        ready: true,
        shopId: "shop-1",
        userId: "user-1",
      }),
    );

    await waitFor(() => expect(result.current.orderCounts.confirmed).toBe(1));
    expect(result.current.eventOrderCount).toBe(1);
  });

  it("reports non-transport initial load failures", async () => {
    mocks.getOrders.mockRejectedValue(new Error("permission denied"));
    mocks.getOrderStatusCounts.mockRejectedValue(
      new Error("permission denied"),
    );

    renderHook(() =>
      useAdminOrdersWorkspace({
        enabled: true,
        ready: true,
        shopId: "shop-1",
        userId: "user-1",
      }),
    );

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Could not load the admin workspace.",
      "Admin unavailable",
    );
  });
});
