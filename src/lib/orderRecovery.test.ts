import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOrderRecovery, loadOrderRecovery, saveOrderRecovery } from "./orderRecovery";
import type { Product } from "../types/catalog";

const product: Product = { id: "p1", name: "Product", collection: "", description: "", price_vnd: 100, item_code: "P1", quantity_available: 2, category: "Test", stock_status: "limited", stock_note: "Limited", images: [], featured: false, sort_order: 1, active: true };

describe("order recovery", () => {
  beforeEach(() => { localStorage.clear(); vi.useRealTimers(); });
  it("parses valid recovery state", () => { const recovery = createOrderRecovery([{ product, quantity: 1 }], "Customer"); saveOrderRecovery(recovery); expect(loadOrderRecovery()).toEqual(recovery); });
  it("rejects malformed stored state", () => { localStorage.setItem("akiba-shelf-active-order-v1", "{bad"); expect(loadOrderRecovery()).toBeNull(); });
  it("expires old recovery state", () => { const recovery = createOrderRecovery([{ product, quantity: 1 }], "Customer"); recovery.startedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); saveOrderRecovery(recovery); expect(loadOrderRecovery()).toBeNull(); });
});
