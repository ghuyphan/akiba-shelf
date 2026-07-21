import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCheckoutSession,
  loadCheckoutSession,
  saveCheckoutSession,
} from "../checkoutSession";
import type { Product } from "../../../types/catalog";

const product: Product = { id: "p1", name: "Product", collection: "", description: "", price_vnd: 100, item_code: "P1", quantity_available: 2, category: "Test", stock_status: "limited", stock_note: "Limited", images: [], featured: false, sort_order: 1, active: true };

describe("checkout session recovery", () => {
  beforeEach(() => { localStorage.clear(); vi.useRealTimers(); });
  it("parses a valid queued session", () => {
    const session = createCheckoutSession(
      "test-shop",
      [{ product, quantity: 1 }],
      "Customer",
    );
    saveCheckoutSession(session);
    expect(loadCheckoutSession("test-shop")).toEqual(session);
  });

  it("rejects malformed stored state", () => {
    localStorage.setItem("akiba-shelf-active-order-v1:test-shop", "{bad");
    expect(loadCheckoutSession("test-shop")).toBeNull();
  });

  it("expires old checkout state", () => {
    const session = createCheckoutSession(
      "test-shop",
      [{ product, quantity: 1 }],
      "Customer",
    );
    session.createdAt = new Date(
      Date.now() - 25 * 60 * 60 * 1000,
    ).toISOString();
    saveCheckoutSession(session);
    expect(loadCheckoutSession("test-shop")).toBeNull();
  });

  it("migrates a synthetic offline order back to a queued intent", () => {
    localStorage.setItem(
      "akiba-shelf-active-order-v1:test-shop",
      JSON.stringify({
        clientRequestId: "11111111-1111-4111-8111-111111111111",
        recoveryToken: "0123456789abcdef0123456789abcdef",
        order: {
          id: "11111111-1111-4111-8111-111111111111",
          order_code: "OFF-TEST",
          customer_name: "Customer",
          total_amount: 100,
          status: "confirmed",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          confirmed_at: null,
          cancelled_at: null,
          expired_at: null,
        },
        cart: [{ product, quantity: 1 }],
        customerName: "Customer",
        startedAt: new Date().toISOString(),
        offline: true,
        offlinePaid: true,
      }),
    );

    const migrated = loadCheckoutSession("test-shop");
    expect(migrated).toMatchObject({
      version: 2,
      state: "queued",
      order: null,
      customerName: "Customer",
    });
    expect(migrated?.lastError).toMatch(/saved offline/i);
  });
});
