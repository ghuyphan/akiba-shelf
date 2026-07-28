import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Order } from "../../../types/catalog";
import {
  clearAdminOfflineData,
  loadAdminAccessSnapshot,
  loadAdminOrdersSnapshot,
  saveAdminAccessSnapshot,
  saveAdminOrdersSnapshot,
} from "../adminOffline";

function order(id: string, source: Order["source"]): Order {
  const now = new Date().toISOString();
  return {
    id,
    order_code: id,
    customer_name: null,
    total_amount: 10_000,
    status: "pending",
    created_at: now,
    updated_at: now,
    expires_at: null,
    confirmed_at: null,
    cancelled_at: null,
    expired_at: null,
    source,
  };
}

describe("admin order snapshots", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps online and Event order caches isolated", () => {
    saveAdminOrdersSnapshot("user-1", "shop-1", [order("online-1", "online")]);
    saveAdminOrdersSnapshot(
      "user-1",
      "shop-1",
      [order("event-1", "offline_event")],
      "event",
    );

    expect(
      loadAdminOrdersSnapshot("user-1", "shop-1").map(({ id }) => id),
    ).toEqual(["online-1"]);
    expect(
      loadAdminOrdersSnapshot("user-1", "shop-1", "event").map(({ id }) => id),
    ).toEqual(["event-1"]);
  });

  it("keeps individual Event histories isolated", () => {
    saveAdminOrdersSnapshot(
      "user-1",
      "shop-1",
      [order("event-1", "offline_event")],
      "event:session-1",
    );
    saveAdminOrdersSnapshot(
      "user-1",
      "shop-1",
      [order("event-2", "offline_event")],
      "event:session-2",
    );

    expect(
      loadAdminOrdersSnapshot("user-1", "shop-1", "event:session-1").map(
        ({ id }) => id,
      ),
    ).toEqual(["event-1"]);
    expect(
      loadAdminOrdersSnapshot("user-1", "shop-1", "event:session-2").map(
        ({ id }) => id,
      ),
    ).toEqual(["event-2"]);
  });

  it("isolates cached access and orders between signed-in users", () => {
    saveAdminAccessSnapshot("user-1", "one@example.test", []);
    saveAdminAccessSnapshot("user-2", "two@example.test", []);
    saveAdminOrdersSnapshot("user-1", "shop-1", [order("one", "online")]);
    saveAdminOrdersSnapshot("user-2", "shop-1", [order("two", "online")]);

    expect(loadAdminAccessSnapshot("user-1")?.email).toBe("one@example.test");
    expect(loadAdminAccessSnapshot("user-2")?.email).toBe("two@example.test");
    expect(loadAdminOrdersSnapshot("user-1", "shop-1")[0].id).toBe("one");
    expect(loadAdminOrdersSnapshot("user-2", "shop-1")[0].id).toBe("two");
  });

  it("expires order snapshots after seven days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T00:00:00.000Z"));
    saveAdminOrdersSnapshot("user-1", "shop-1", [order("recent", "online")]);

    vi.setSystemTime(new Date("2026-07-08T00:00:00.001Z"));
    expect(loadAdminOrdersSnapshot("user-1", "shop-1")).toEqual([]);
  });

  it("expires access snapshots after seven days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T00:00:00.000Z"));
    saveAdminAccessSnapshot("user-1", "one@example.test", []);

    vi.setSystemTime(new Date("2026-07-08T00:00:00.001Z"));
    expect(loadAdminAccessSnapshot("user-1")).toBeNull();
  });

  it("treats quota failures as best-effort snapshot writes", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });

    expect(
      saveAdminAccessSnapshot("user-1", "one@example.test", []),
    ).toBe(false);
    expect(
      saveAdminOrdersSnapshot("user-1", "shop-1", [order("one", "online")]),
    ).toBe(false);
  });

  it("treats storage security errors as a cache miss", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new DOMException("Storage blocked", "SecurityError");
    });

    expect(loadAdminAccessSnapshot("user-1")).toBeNull();
    expect(loadAdminOrdersSnapshot("user-1", "shop-1")).toEqual([]);
  });

  it("persists only the dedicated offline order and membership shape", () => {
    const membership = {
      shop_id: "shop-1",
      shop_name: "Shop",
      shop_slug: "shop",
      role: "owner" as const,
      active: true,
      shop_active: true,
      private_note: "do not persist",
    };
    const fullOrder = {
      ...order("one", "online"),
      internal_retry_token: "do not persist",
    };

    saveAdminAccessSnapshot("user-1", "one@example.test", [membership]);
    saveAdminOrdersSnapshot("user-1", "shop-1", [fullOrder]);

    expect(
      JSON.parse(localStorage.getItem("matsuri-admin-access-v1:user-1") ?? ""),
    ).not.toHaveProperty("memberships.0.private_note");
    expect(
      JSON.parse(
        localStorage.getItem(
          "matsuri-admin-orders-v1:user-1:shop-1:online",
        ) ?? "",
      ),
    ).not.toHaveProperty("orders.0.internal_retry_token");
  });

  it("purges malformed cached memberships", () => {
    const key = "matsuri-admin-access-v1:user-1";
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 2,
        userId: "user-1",
        memberships: [{ shop_id: "shop-1", role: "super-admin" }],
        savedAt: new Date().toISOString(),
      }),
    );

    expect(loadAdminAccessSnapshot("user-1")).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });

  it("purges corrupt cached JSON", () => {
    const accessKey = "matsuri-admin-access-v1:user-1";
    const ordersKey = "matsuri-admin-orders-v1:user-1:shop-1:online";
    localStorage.setItem(accessKey, "{not-json");
    localStorage.setItem(ordersKey, "{not-json");

    expect(loadAdminAccessSnapshot("user-1")).toBeNull();
    expect(loadAdminOrdersSnapshot("user-1", "shop-1")).toEqual([]);
    expect(localStorage.getItem(accessKey)).toBeNull();
    expect(localStorage.getItem(ordersKey)).toBeNull();
  });

  it("invalidates snapshots from an older cache schema", () => {
    const key = "matsuri-admin-access-v1:user-1";
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        userId: "user-1",
        memberships: [],
        savedAt: new Date().toISOString(),
      }),
    );

    expect(loadAdminAccessSnapshot("user-1")).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });

  it("purges malformed cached orders", () => {
    const key = "matsuri-admin-orders-v1:user-1:shop-1:online";
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 2,
        shopId: "shop-1",
        source: "online",
        orders: [{ ...order("bad", "online"), status: "paid" }],
        savedAt: new Date().toISOString(),
      }),
    );

    expect(loadAdminOrdersSnapshot("user-1", "shop-1")).toEqual([]);
    expect(localStorage.getItem(key)).toBeNull();
  });

  it("purges only the signing-out user's offline admin data", () => {
    saveAdminAccessSnapshot("user-1", "one@example.test", []);
    saveAdminAccessSnapshot("user-2", "two@example.test", []);
    saveAdminOrdersSnapshot("user-1", "shop-1", [order("one", "online")]);
    saveAdminOrdersSnapshot("user-2", "shop-1", [order("two", "online")]);

    clearAdminOfflineData("user-1");

    expect(loadAdminAccessSnapshot("user-1")).toBeNull();
    expect(loadAdminOrdersSnapshot("user-1", "shop-1")).toEqual([]);
    expect(loadAdminAccessSnapshot("user-2")).not.toBeNull();
    expect(loadAdminOrdersSnapshot("user-2", "shop-1")).toHaveLength(1);
  });

  it("purges legacy unscoped order snapshots during sign-out", () => {
    localStorage.setItem("matsuri-admin-orders-v1:shop-1", "legacy");
    localStorage.setItem("matsuri-admin-orders-v1:shop-1:event", "legacy");
    saveAdminOrdersSnapshot("user-2", "shop-1", [order("two", "online")]);

    clearAdminOfflineData("user-1");

    expect(localStorage.getItem("matsuri-admin-orders-v1:shop-1")).toBeNull();
    expect(
      localStorage.getItem("matsuri-admin-orders-v1:shop-1:event"),
    ).toBeNull();
    expect(loadAdminOrdersSnapshot("user-2", "shop-1")).toHaveLength(1);
  });
});
