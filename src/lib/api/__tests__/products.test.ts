import { describe, expect, it } from "vitest";
import { LIMITED_STOCK_THRESHOLD } from "../../constants";
import { normalizeProduct } from "../products";

describe("product normalization", () => {
  it("uses the shared threshold for limited stock", () => {
    expect(
      normalizeProduct({ quantity_available: LIMITED_STOCK_THRESHOLD })
        .stock_status,
    ).toBe("limited");
    expect(
      normalizeProduct({ quantity_available: LIMITED_STOCK_THRESHOLD + 1 })
        .stock_status,
    ).toBe("in_stock");
    expect(normalizeProduct({ quantity_available: 0 }).stock_status).toBe(
      "sold_out",
    );
  });
});
