import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { loadOfflineEventSession, hasEventDevicePin } = vi.hoisted(() => ({
  loadOfflineEventSession: vi.fn(),
  hasEventDevicePin: vi.fn(),
}));

vi.mock("../../lib/offline/offlineEvents", () => ({
  loadOfflineEventSession,
  OFFLINE_EVENT_UPDATED: "offline-updated",
}));

vi.mock("../../lib/offline/eventAccess", () => ({
  hasEventDevicePin,
  OFFLINE_EVENT_ACCESS_UPDATED: "access-updated",
}));

import { useCatalogEventState } from "./useCatalogEventState";

describe("useCatalogEventState", () => {
  afterEach(() => vi.resetAllMocks());

  it("projects active event and PIN requirements", async () => {
    loadOfflineEventSession.mockResolvedValue({ status: "active" });
    hasEventDevicePin.mockReturnValue(true);

    const { result } = renderHook(() => useCatalogEventState("shop-1"));

    await waitFor(() =>
      expect(result.current).toEqual({
        salesActive: true,
        adminPinRequired: true,
      }),
    );
  });

  it("resets to inactive when the shop is unavailable", async () => {
    const { result } = renderHook(() => useCatalogEventState(undefined));
    await waitFor(() =>
      expect(result.current).toEqual({
        salesActive: false,
        adminPinRequired: false,
      }),
    );
    expect(loadOfflineEventSession).not.toHaveBeenCalled();
  });
});
