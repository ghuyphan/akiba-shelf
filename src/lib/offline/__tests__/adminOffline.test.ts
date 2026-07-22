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
  afterEach(() => vi.useRealTimers());

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
