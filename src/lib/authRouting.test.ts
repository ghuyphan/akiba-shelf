import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingInvitation,
  getPendingInvitation,
  routeAfterAuthentication,
  storePendingInvitation,
} from "./authRouting";

describe("auth routing", () => {
  beforeEach(() => clearPendingInvitation());

  it("routes both active and inactive memberships to the dashboard", () => {
    expect(routeAfterAuthentication([{ active: true } as never])).toBe(
      "/dashboard",
    );
    expect(routeAfterAuthentication([{ active: false } as never])).toBe(
      "/dashboard",
    );
    expect(routeAfterAuthentication([])).toBe("/dashboard/shops/new");
  });

  it("stores only a short-lived invitation identifier", () => {
    expect(storePendingInvitation("20000000-0000-4000-8000-000000000001")).toBe(
      true,
    );
    expect(getPendingInvitation()).toBe("20000000-0000-4000-8000-000000000001");
    expect(storePendingInvitation("not-an-id")).toBe(false);
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 31 * 60 * 1000);
    expect(getPendingInvitation()).toBeNull();
    vi.restoreAllMocks();
  });
});
