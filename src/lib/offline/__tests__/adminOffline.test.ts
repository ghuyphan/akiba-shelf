import { beforeEach, describe, expect, it } from "vitest";
import type { Order } from "../../../types/catalog";
import {
  loadAdminOrdersSnapshot,
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

  it("keeps online and Event order caches isolated", () => {
    saveAdminOrdersSnapshot("shop-1", [order("online-1", "online")]);
    saveAdminOrdersSnapshot(
      "shop-1",
      [order("event-1", "offline_event")],
      "event",
    );

    expect(loadAdminOrdersSnapshot("shop-1").map(({ id }) => id)).toEqual([
      "online-1",
    ]);
    expect(
      loadAdminOrdersSnapshot("shop-1", "event").map(({ id }) => id),
    ).toEqual(["event-1"]);
  });
});
