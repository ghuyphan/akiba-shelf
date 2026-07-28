import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, getShopMemberships, unsubscribe } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getShopMemberships: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession,
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe } },
      })),
    },
  },
}));

vi.mock("../../lib/api/shops", () => ({ getShopMemberships }));

import { useAdminSession } from "./useAdminSession";

const membership = {
  shop_id: "shop-1",
  shop_name: "Shop",
  shop_slug: "shop",
  role: "owner" as const,
  active: true,
  shop_active: true,
};

describe("useAdminSession storage reliability", () => {
  beforeEach(() => {
    localStorage.clear();
    getSession.mockResolvedValue({
      data: { session: { user: { id: "user-1", email: "one@example.test" } } },
      error: null,
    });
    getShopMemberships.mockResolvedValue([membership]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("keeps successful remote authentication valid when storage writes fail", async () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });

    const { result } = renderHook(() => useAdminSession());

    await waitFor(() => expect(result.current.state.status).toBe("authorized"));
    expect(result.current.state).toMatchObject({
      status: "authorized",
      access: membership,
    });
  });

  it("selects a valid shop even when selected-shop persistence is blocked", async () => {
    const secondMembership = {
      ...membership,
      shop_id: "shop-2",
      shop_name: "Second",
      shop_slug: "second",
    };
    getShopMemberships.mockResolvedValue([membership, secondMembership]);
    const { result } = renderHook(() => useAdminSession());
    await waitFor(() => expect(result.current.state.status).toBe("authorized"));

    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("Storage blocked", "SecurityError");
    });
    result.current.selectShop("shop-2");

    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        status: "authorized",
        access: secondMembership,
      }),
    );
  });
});
