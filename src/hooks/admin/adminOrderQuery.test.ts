import { describe, expect, it } from "vitest";
import {
  getAdminOrderCountScopeKey,
  getAdminOrderQueryKey,
  getLocalOrderDateScope,
} from "./adminOrderQuery";

describe("admin order query helpers", () => {
  it("builds stable keys for the visible order scope", () => {
    expect(
      getAdminOrderQueryKey({
        shopId: "shop",
        page: 2,
        filter: "event",
        selectedEventId: "session",
        todayOnly: true,
      }),
    ).toBe("shop:2:event:session:today");
    expect(getAdminOrderCountScopeKey("shop", false)).toBe("shop:all");
    expect(getAdminOrderCountScopeKey("shop", "2026-08-20")).toBe(
      "shop:2026-08-20",
    );
  });

  it("uses the staff device local day, custom date, and omits dates for all-time views", () => {
    const now = new Date(2026, 6, 28, 15, 30);
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    expect(getLocalOrderDateScope(true, now)).toEqual({
      createdAfter: start.toISOString(),
      createdBefore: end.toISOString(),
    });
    expect(getLocalOrderDateScope("today", now)).toEqual({
      createdAfter: start.toISOString(),
      createdBefore: end.toISOString(),
    });
    expect(getLocalOrderDateScope(false, now)).toEqual({});
    expect(getLocalOrderDateScope("all", now)).toEqual({});

    const customStart = new Date(2026, 7, 20, 0, 0, 0, 0);
    const customEnd = new Date(2026, 7, 21, 0, 0, 0, 0);
    expect(getLocalOrderDateScope("2026-08-20", now)).toEqual({
      createdAfter: customStart.toISOString(),
      createdBefore: customEnd.toISOString(),
    });

    const rangeStart = new Date(2026, 7, 10, 0, 0, 0, 0);
    const rangeEnd = new Date(2026, 7, 21, 0, 0, 0, 0);
    expect(getLocalOrderDateScope("2026-08-10..2026-08-20", now)).toEqual({
      createdAfter: rangeStart.toISOString(),
      createdBefore: rangeEnd.toISOString(),
    });
  });
});
