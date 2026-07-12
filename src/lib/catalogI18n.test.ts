import { describe, expect, it } from "vitest";
import { translations } from "./catalogI18n";

describe("catalog translations", () => {
  it("keeps English and Vietnamese dictionary keys in parity", () => {
    expect(Object.keys(translations.vi).sort()).toEqual(Object.keys(translations.en).sort());
  });
});
