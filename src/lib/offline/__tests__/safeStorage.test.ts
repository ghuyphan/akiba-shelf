import { afterEach, describe, expect, it, vi } from "vitest";
import {
  safeLocalStorageGet,
  safeLocalStorageRemove,
  safeLocalStorageSet,
  safeSessionStorageGet,
  safeSessionStorageRemove,
  safeSessionStorageSet,
} from "../safeStorage";

describe("safe local storage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns false instead of throwing when writes exceed quota", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });

    expect(safeLocalStorageSet("key", "value")).toBe(false);
  });

  it("returns a cache miss when storage access is blocked", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new DOMException("Storage blocked", "SecurityError");
    });

    expect(safeLocalStorageGet("key")).toBeNull();
  });

  it("makes cleanup best-effort when storage access is blocked", () => {
    vi.spyOn(window.localStorage, "removeItem").mockImplementation(() => {
      throw new DOMException("Storage blocked", "SecurityError");
    });

    expect(safeLocalStorageRemove("key")).toBe(false);
  });

  it("keeps chunk retry flags best-effort when session storage is blocked", () => {
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: {
        getItem: () => {
          throw new DOMException("Storage blocked", "SecurityError");
        },
        setItem: () => {
          throw new DOMException("Storage blocked", "SecurityError");
        },
        removeItem: () => {
          throw new DOMException("Storage blocked", "SecurityError");
        },
      },
    });

    expect(safeSessionStorageGet("chunk-reload:app")).toBeNull();
    expect(safeSessionStorageSet("chunk-reload:app", "1")).toBe(false);
    expect(safeSessionStorageRemove("chunk-reload:app")).toBe(false);
  });
});
