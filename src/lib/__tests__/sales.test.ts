import { describe, expect, it } from "vitest";
import type { Order } from "../../types/catalog";
import { mergeSalesSummaries, projectSalesSummary } from "../sales";

const from = "2026-07-29T00:00:00.000Z";
const to = "2026-07-30T00:00:00.000Z";

function order(overrides: Partial<Order>): Order {
  const base: Order = {
    id: "order-1",
    order_code: "A-1",
    customer_name: null,
    total_amount: 90_000,
    discount_amount: 10_000,
    status: "confirmed",
    created_at: from,
    updated_at: from,
    expires_at: null,
    confirmed_at: "2026-07-29T01:00:00.000Z",
    cancelled_at: null,
    expired_at: null,
    order_items: [
      {
        id: "item-1",
        order_id: "order-1",
        product_id: "product-1",
        quantity: 1,
        unit_price: 100_000,
        discount_amount: 10_000,
        product: {
          id: "product-1",
          name: "Print",
          item_code: "P-1",
          images: [],
        },
      },
    ],
  };
  return Object.assign(base, overrides);
}

describe("sales projection", () => {
  it("counts only confirmed orders in the confirmation range", () => {
    const summary = projectSalesSummary(
      [
        order({}),
        order({ id: "pending", status: "pending", total_amount: 200_000 }),
      ],
      from,
      to,
    );
    expect(summary).toMatchObject({
      revenue: 90_000,
      discount_amount: 10_000,
      confirmed_order_count: 1,
      units_sold: 1,
      online_revenue: 90_000,
    });
  });

  it("merges unsynced event revenue without replacing server totals", () => {
    const online = projectSalesSummary([order({})], from, to);
    const event = projectSalesSummary(
      [
        order({
          id: "event-1",
          source: "offline_event",
          payment_method: "cash",
          total_amount: 50_000,
          discount_amount: 0,
        }),
      ],
      from,
      to,
    );
    expect(mergeSalesSummaries(online, event)).toMatchObject({
      revenue: 140_000,
      online_revenue: 90_000,
      event_revenue: 50_000,
      cash_revenue: 50_000,
      confirmed_order_count: 2,
    });
  });
});
