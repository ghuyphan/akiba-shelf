import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
  loadOfflineEventSession,
  hasEventDevicePin,
  getEventAdminUnlockExpiresAt,
  verifyEventDevicePin,
} = vi.hoisted(() => ({
  loadOfflineEventSession: vi.fn(),
  hasEventDevicePin: vi.fn(),
  getEventAdminUnlockExpiresAt: vi.fn(),
  verifyEventDevicePin: vi.fn(),
}));

vi.mock("../../lib/offline/offlineEvents", () => ({
  loadOfflineEventSession,
  OFFLINE_EVENT_UPDATED: "offline-updated",
}));

vi.mock("../../lib/offline/eventAccess", () => ({
  hasEventDevicePin,
  getEventAdminUnlockExpiresAt,
  verifyEventDevicePin,
  OFFLINE_EVENT_ACCESS_UPDATED: "access-updated",
}));

import { useAdminEventAccess } from "./useAdminEventAccess";

describe("useAdminEventAccess", () => {
  afterEach(() => vi.resetAllMocks());

  it("locks an active event with a configured but expired PIN unlock", async () => {
    loadOfflineEventSession.mockResolvedValue({
      status: "open",
      name: "Summer Event",
    });
    hasEventDevicePin.mockReturnValue(true);
    getEventAdminUnlockExpiresAt.mockReturnValue(null);

    const { result } = renderHook(() => useAdminEventAccess(true, "shop-1"));

    await waitFor(() =>
      expect(result.current.state).toEqual({
        status: "locked",
        eventName: "Summer Event",
      }),
    );
    act(() => result.current.unlock());
    expect(result.current.state).toEqual({ status: "unlocked" });
  });

  it("returns unlocked access when the hook is disabled", async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useAdminEventAccess(enabled, "shop-1"),
      { initialProps: { enabled: false } },
    );

    await waitFor(() =>
      expect(result.current.state).toEqual({ status: "unlocked" }),
    );
    loadOfflineEventSession.mockResolvedValue(null);
    hasEventDevicePin.mockReturnValue(false);
    rerender({ enabled: true });
    expect(loadOfflineEventSession).toHaveBeenCalledWith("shop-1");
  });
});
