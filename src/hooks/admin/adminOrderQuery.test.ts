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
    ).toBe("shop:2:event:session:true");
    expect(getAdminOrderCountScopeKey("shop", false)).toBe("shop:false");
  });

  it("uses the staff device local day and omits dates for all-time views", () => {
    const now = new Date(2026, 6, 28, 15, 30);
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    expect(getLocalOrderDateScope(true, now)).toEqual({
      createdAfter: start.toISOString(),
      createdBefore: end.toISOString(),
    });
    expect(getLocalOrderDateScope(false, now)).toEqual({});
  });
});
