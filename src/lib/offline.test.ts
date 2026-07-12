import { beforeEach, describe, expect, it } from "vitest";
import { loadCart, saveCart } from "./offline";
import type { CartItem, Product } from "../types/catalog";

const product: Product = { id: "p1", name: "Product", collection: "", description: "", price_vnd: 100, item_code: "P1", quantity_available: 2, category: "Test", stock_status: "limited", stock_note: "Limited", images: [], featured: false, sort_order: 1, active: true };

describe("offline cart persistence", () => {
  beforeEach(() => localStorage.clear());
  it("round-trips valid carts", () => { const items: CartItem[] = [{ product, quantity: 2 }]; saveCart(items); expect(loadCart()).toEqual(items); });
  it("clears invalid or over-trusting stored data", () => { localStorage.setItem("akiba-shelf-cart-v1", JSON.stringify({ version: 1, items: [{ product, quantity: 0 }] })); expect(loadCart()).toEqual([]); expect(localStorage.getItem("akiba-shelf-cart-v1")).toBeNull(); });
});
