import { describe, expect, it } from "vitest";
import { getPlatformTranslation } from "../platformI18n";

describe("platform translations", () => {
  it("interpolates Vietnamese platform copy", () => {
    expect(
      getPlatformTranslation("{{count}} matching orders", "vi", { count: 4 }),
    ).toBe("4 đơn phù hợp");
  });

  it("keeps the product vocabulary requested by the brand", () => {
    const copy = [
      getPlatformTranslation("Made for artists, not spreadsheets", "vi"),
      getPlatformTranslation(
        "Matsuri turns your merch table into a friendly digital storefront, with live orders and accurate stock while you focus on meeting fans.",
        "vi",
      ),
      getPlatformTranslation("Staff sign in", "vi"),
    ].join(" ");

    expect(copy).toContain("artist");
    expect(copy).toContain("merch");
    expect(copy).toContain("fan");
    expect(copy).toContain("staff");
    expect(copy).not.toMatch(/nghệ sĩ|nhân viên|người hâm mộ/i);
  });
});
