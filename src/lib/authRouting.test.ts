import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingInvitation,
  clearPasswordFlow,
  getPasswordFlow,
  getPendingInvitation,
  routeAfterAuthentication,
  storePendingInvitation,
  storePasswordFlow,
} from "./authRouting";

describe("auth routing", () => {
  beforeEach(() => {
    clearPendingInvitation();
    clearPasswordFlow();
  });

  it("routes both active and inactive memberships to the dashboard", () => {
    expect(routeAfterAuthentication([{ active: true } as never])).toBe(
      "/dashboard",
    );
    expect(routeAfterAuthentication([{ active: false } as never])).toBe(
      "/dashboard",
    );
    expect(routeAfterAuthentication([])).toBe("/dashboard");
  });

  it("keeps invitation and recovery password flows short-lived and distinct", () => {
    storePasswordFlow("recovery");
    expect(getPasswordFlow()).toBe("recovery");
    storePendingInvitation("20000000-0000-4000-8000-000000000001");
    expect(getPasswordFlow()).toBe("invitation");
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 31 * 60 * 1000);
    expect(getPasswordFlow()).toBeNull();
    vi.restoreAllMocks();
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
