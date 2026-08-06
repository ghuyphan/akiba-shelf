import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/errors", () => ({
  getErrorMessage: (_error: unknown, fallback: string) => fallback,
  isSessionNoise: () => false,
}));

import { useAdminEventOrderRefresh } from "./useAdminEventOrderRefresh";

describe("useAdminEventOrderRefresh", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("refreshes only matching Event updates and removes listeners on cleanup", async () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderHook(() =>
      useAdminEventOrderRefresh({
        enabled: true,
        ready: true,
        active: true,
        shopId: "shop-1",
        reload,
        onError: vi.fn(),
      }),
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent("matsuri:offline-event-updated", {
          detail: { shopId: "shop-2" },
        }),
      );
      vi.advanceTimersByTime(200);
    });
    expect(reload).not.toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("matsuri:offline-event-updated", {
          detail: { shopId: "shop-1" },
        }),
      );
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(reload).toHaveBeenCalledWith(true);

    reload.mockClear();
    unmount();
    act(() => {
      window.dispatchEvent(new Event("focus"));
      vi.advanceTimersByTime(200);
    });
    expect(reload).not.toHaveBeenCalled();
  });
});
