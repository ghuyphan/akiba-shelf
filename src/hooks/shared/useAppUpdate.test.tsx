import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppUpdate } from "./useAppUpdate";

const releaseMocks = vi.hoisted(() => ({
  fetchReleaseMetadata: vi.fn(),
  hasNewerRelease: vi.fn(() => true),
}));

vi.mock("../../lib/release", () => releaseMocks);
vi.mock("../../utils/lazyWithRetry", () => ({
  reloadForAppUpdate: vi.fn().mockResolvedValue(undefined),
}));

describe("useAppUpdate", () => {
  async function flushUpdateCheck() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    releaseMocks.fetchReleaseMetadata.mockReset();
    releaseMocks.hasNewerRelease.mockReturnValue(true);
    sessionStorage.clear();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("deduplicates update checks triggered while a request is in flight", async () => {
    let resolveRequest: ((value: { release: string }) => void) | undefined;
    releaseMocks.fetchReleaseMetadata.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    const { result } = renderHook(() => useAppUpdate());

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
    });

    expect(releaseMocks.fetchReleaseMetadata).toHaveBeenCalledOnce();

    await act(async () => {
      resolveRequest?.({ release: "next-release" });
      await Promise.resolve();
    });

    expect(result.current.isUpdateAvailable).toBe(true);
  });

  it("dismisses only the current release for the browser session", async () => {
    releaseMocks.fetchReleaseMetadata
      .mockResolvedValueOnce({ release: "release-a" })
      .mockResolvedValueOnce({ release: "release-a" })
      .mockResolvedValueOnce({ release: "release-b" });
    const { result } = renderHook(() => useAppUpdate());

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await flushUpdateCheck();
    });
    expect(result.current.isUpdateAvailable).toBe(true);
    act(() => result.current.dismiss());

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await flushUpdateCheck();
    });
    expect(releaseMocks.fetchReleaseMetadata).toHaveBeenCalledTimes(2);
    expect(result.current.isUpdateAvailable).toBe(false);

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await flushUpdateCheck();
    });
    expect(result.current.isUpdateAvailable).toBe(true);
  });

  it("aborts the active release request when unmounted", async () => {
    releaseMocks.fetchReleaseMetadata.mockImplementation(
      (_fetcher: typeof fetch, signal: AbortSignal) =>
        new Promise((resolve) => {
          signal.addEventListener("abort", () => resolve(null));
        }),
    );
    const { unmount } = renderHook(() => useAppUpdate());

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });
    const signal = releaseMocks.fetchReleaseMetadata.mock.calls[0]?.[1] as
      | AbortSignal
      | undefined;
    unmount();

    expect(signal?.aborted).toBe(true);
  });
});
