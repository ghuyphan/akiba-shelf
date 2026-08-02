import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultPromotion } from "../../lib/constants";
import { useScheduledPromotion } from "./useScheduledPromotion";

afterEach(() => vi.useRealTimers());

describe("useScheduledPromotion", () => {
  it("re-evaluates promotion activity at the next configured boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-02T00:00:00.000Z"));
    const promotion = {
      ...defaultPromotion,
      enabled: true,
      starts_at: "2026-08-02T00:00:01.000Z",
      ends_at: "2026-08-02T00:01:00.000Z",
    };
    const { result } = renderHook(() => useScheduledPromotion(promotion));

    expect(result.current.enabled).toBe(false);
    act(() => vi.advanceTimersByTime(1_025));
    expect(result.current.enabled).toBe(true);
  });
});
