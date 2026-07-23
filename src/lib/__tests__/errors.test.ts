import { describe, expect, it } from "vitest";
import {
  getErrorMessage,
  getUserFacingErrorMessage,
  isSessionNoise,
  isTransportError,
} from "../errors";

describe("getErrorMessage", () => {
  it("sanitizes database check constraint errors into human friendly copy", () => {
    const error = new Error(
      'new row for relation "gacha_settings" violates check constraint "gacha_settings_lightcone_legendary_soft_pity_check"',
    );
    expect(getErrorMessage(error)).toBe(
      "The Light Cone 5-star soft pity must be lower than its hard pity.",
    );
  });

  it("sanitizes unknown database constraint errors into fallback message", () => {
    const error = new Error(
      'new row for relation "unknown_table" violates check constraint "some_check"',
    );
    expect(getErrorMessage(error, "Could not save item.")).toBe(
      "Could not save item.",
    );
  });

  it("passes friendly error messages through unchanged", () => {
    const error = new Error("Every active banner needs at least one merch item.");
    expect(getErrorMessage(error)).toBe("Every active banner needs at least one merch item.");
  });

  it("keeps short plain-language action errors user-facing", () => {
    expect(
      getUserFacingErrorMessage(
        new Error("This order was already handled."),
        "Could not update the order.",
      ),
    ).toBe("This order was already handled.");
  });

  it("sanitizes normalized string errors without discarding friendly copy", () => {
    expect(
      getUserFacingErrorMessage(
        "Sale price must be lower than the regular price.",
        "Could not update the item.",
      ),
    ).toBe("Sale price must be lower than the regular price.");
    expect(
      getUserFacingErrorMessage(
        'relation "products" violates constraint "products_check"',
        "Could not update the item.",
      ),
    ).toBe("Could not update the item.");
  });

  it("replaces technical, structured, and oversized errors", () => {
    const fallback = "Could not update the order.";
    expect(
      getUserFacingErrorMessage(
        new Error('relation "orders" violates constraint "orders_check"'),
        fallback,
      ),
    ).toBe(fallback);
    expect(
      getUserFacingErrorMessage(
        new Error('{"message":"upstream failed","request_id":"secret"}'),
        fallback,
      ),
    ).toBe(fallback);
    expect(
      getUserFacingErrorMessage(new Error("x".repeat(241)), fallback),
    ).toBe(fallback);
    expect(
      getUserFacingErrorMessage(
        new Error("permission denied for function get_shop_members"),
        fallback,
      ),
    ).toBe(fallback);
  });

  it("identifies session noise correctly", () => {
    expect(isSessionNoise(new Error("JWT expired"))).toBe(true);
    expect(isSessionNoise(new Error("Database connection error"))).toBe(false);
  });

  it("does not classify unrelated TypeErrors as connection failures", () => {
    expect(
      isTransportError(new TypeError("Cannot read properties of undefined")),
    ).toBe(false);
    expect(isTransportError(new TypeError("Failed to fetch"))).toBe(true);
  });
});
