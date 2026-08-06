import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("../../lib/realtime", () => ({
  subscribeToAdminOrderChanges: mocks.subscribe,
}));

import { useAdminOrderRealtime } from "./useAdminOrderRealtime";

describe("useAdminOrderRealtime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.subscribe.mockReturnValue(mocks.unsubscribe);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("debounces bursts and reports refresh failures", async () => {
    const error = new Error("refresh failed");
    const onRefresh = vi.fn().mockRejectedValue(error);
    const onError = vi.fn();
    renderHook(() =>
      useAdminOrderRealtime({
        enabled: true,
        shopId: "shop-1",
        onRefresh,
        onError,
      }),
    );
    const onChange = mocks.subscribe.mock.calls[0][1] as () => void;

    act(() => {
      onChange();
      onChange();
      vi.advanceTimersByTime(200);
    });
    await act(async () => Promise.resolve());

    expect(onRefresh).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(error);
  });

  it("replaces subscriptions when the shop changes and cleans up timers", () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { rerender, unmount } = renderHook(
      ({ shopId }) =>
        useAdminOrderRealtime({
          enabled: true,
          shopId,
          onRefresh,
          onError: vi.fn(),
        }),
      { initialProps: { shopId: "shop-1" } },
    );

    rerender({ shopId: "shop-2" });
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
    expect(mocks.subscribe).toHaveBeenLastCalledWith(
      "shop-2",
      expect.any(Function),
    );
    unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(2);
  });
});
