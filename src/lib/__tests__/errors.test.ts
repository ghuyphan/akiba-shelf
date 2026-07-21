import { describe, expect, it } from "vitest";
import { getErrorMessage, isSessionNoise, isTransportError } from "../errors";

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
