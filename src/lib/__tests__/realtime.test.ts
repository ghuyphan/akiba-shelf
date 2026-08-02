import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  client: null as unknown,
  trackClientEvent: vi.fn(),
}));

vi.mock("../supabase", () => ({
  get supabase() {
    return mocks.client;
  },
}));

vi.mock("../observability", () => ({
  trackClientEvent: mocks.trackClientEvent,
}));

import {
  subscribeToAdminOrderChanges,
  subscribeToCatalogChanges,
} from "../realtime";

function createRealtimeClient() {
  let statusHandler: ((status: string, error?: unknown) => void) | undefined;
  const channel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn((handler: (status: string, error?: unknown) => void) => {
      statusHandler = handler;
      return channel;
    }),
  };
  const client = {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn().mockResolvedValue(undefined),
  };
  mocks.client = client;
  return {
    channel,
    client,
    emitStatus: (status: string, error?: unknown) =>
      statusHandler?.(status, error),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.client = null;
});

describe("catalog Realtime", () => {
  it("subscribes to every catalog table and reports unexpected disconnects", () => {
    const realtime = createRealtimeClient();
    const onChange = vi.fn();
    const onStatus = vi.fn();

    const unsubscribe = subscribeToCatalogChanges("shop-1", {
      onChange,
      onStatus,
    });

    expect(realtime.client.channel).toHaveBeenCalledWith(
      "shop-shop-1-catalog-db-changes",
    );
    expect(realtime.channel.on).toHaveBeenCalledTimes(5);
    for (const table of [
      "products",
      "booth_settings",
      "payment_settings",
      "promotions",
      "promotion_products",
    ]) {
      expect(realtime.channel.on).toHaveBeenCalledWith(
        "postgres_changes",
        expect.objectContaining({ table, filter: "shop_id=eq.shop-1" }),
        expect.any(Function),
      );
    }

    const error = new Error("socket closed");
    realtime.emitStatus("CHANNEL_ERROR", error);
    expect(onStatus).toHaveBeenCalledWith("CHANNEL_ERROR", error);
    expect(mocks.trackClientEvent).toHaveBeenCalledWith(
      "realtime_disconnect",
      { surface: "storefront", status: "CHANNEL_ERROR" },
      "warning",
    );

    unsubscribe();
    realtime.emitStatus("TIMED_OUT");
    expect(realtime.client.removeChannel).toHaveBeenCalledWith(
      realtime.channel,
    );
    expect(mocks.trackClientEvent).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when Supabase is unavailable", () => {
    expect(() => subscribeToCatalogChanges("shop-1", { onChange: vi.fn() })()).not
      .toThrow();
  });
});

describe("admin order Realtime", () => {
  it("watches orders and order items with the active shop filter", () => {
    const realtime = createRealtimeClient();
    const onChange = vi.fn();

    const unsubscribe = subscribeToAdminOrderChanges("shop-2", onChange);

    expect(realtime.channel.on).toHaveBeenCalledTimes(2);
    expect(realtime.channel.on).toHaveBeenNthCalledWith(
      1,
      "postgres_changes",
      expect.objectContaining({ table: "orders", filter: "shop_id=eq.shop-2" }),
      onChange,
    );
    expect(realtime.channel.on).toHaveBeenNthCalledWith(
      2,
      "postgres_changes",
      expect.objectContaining({
        table: "order_items",
        filter: "shop_id=eq.shop-2",
      }),
      onChange,
    );

    realtime.emitStatus("TIMED_OUT");
    expect(mocks.trackClientEvent).toHaveBeenCalledWith(
      "realtime_disconnect",
      { surface: "admin_orders", status: "TIMED_OUT" },
      "warning",
    );
    unsubscribe();
  });
});
