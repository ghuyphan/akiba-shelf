import { describe, expect, it } from "vitest";
import { getPlatformTranslation } from "../platformI18n";

describe("platform translations", () => {
  it("interpolates Vietnamese platform copy", () => {
    expect(
      getPlatformTranslation("{{count}} matching orders", "vi", { count: 4 }),
    ).toBe("4 đơn phù hợp");
  });

  it("keeps Vietnamese order status labels natural in each context", () => {
    expect(getPlatformTranslation("Pending", "vi")).toBe("Đang chờ");
    expect(getPlatformTranslation("Pending orders", "vi")).toBe(
      "Đơn đang chờ",
    );
    expect(
      getPlatformTranslation("No {{status}} orders", "vi", {
        status: getPlatformTranslation("pending", "vi"),
      }),
    ).toBe("Không có đơn đang chờ");
  });

  it("keeps brand vocabulary while localizing operational roles", () => {
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
    expect(copy).toContain("nhân viên");
    expect(copy).not.toMatch(/nghệ sĩ|người hâm mộ/i);
  });

  it("translates gacha odds presets", () => {
    expect(getPlatformTranslation("Convention Booth Mode", "vi")).toBe(
      "Chế độ gian hàng sự kiện",
    );
    expect(getPlatformTranslation("Official Genshin Replica", "vi")).toBe(
      "Mô phỏng tỷ lệ Genshin gốc",
    );
    expect(
      getPlatformTranslation(
        "Exact official game rates (90 character pity, 80 Light Cone pity).",
        "vi",
      ),
    ).toContain("Nón Ánh Sáng ở lượt 80");
  });
});
