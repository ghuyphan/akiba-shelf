import { describe, expect, it, vi } from "vitest";
import {
  getInitialPlatformLocale,
  PLATFORM_LOCALE_STORAGE_KEY,
  savePlatformLocale,
} from "./platformLocaleStorage";

describe("platform locale storage", () => {
  it("prefers a saved locale and falls back to the browser language", () => {
    expect(getInitialPlatformLocale({ getItem: () => "en" }, "vi-VN")).toBe(
      "en",
    );
    expect(getInitialPlatformLocale({ getItem: () => null }, "vi-VN")).toBe(
      "vi",
    );
    expect(getInitialPlatformLocale({ getItem: () => null }, "en-US")).toBe(
      "en",
    );
  });

  it("tolerates unavailable storage for reads and writes", () => {
    expect(
      getInitialPlatformLocale(
        {
          getItem() {
            throw new Error("blocked");
          },
        },
        "vi",
      ),
    ).toBe("vi");
    expect(() =>
      savePlatformLocale("vi", {
        setItem() {
          throw new Error("blocked");
        },
      }),
    ).not.toThrow();

    const setItem = vi.fn();
    savePlatformLocale("en", { setItem });
    expect(setItem).toHaveBeenCalledWith(PLATFORM_LOCALE_STORAGE_KEY, "en");
  });

  it("tolerates a browser that throws while exposing local storage", () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "localStorage",
    );
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });

    try {
      expect(getInitialPlatformLocale(undefined, "vi-VN")).toBe("vi");
      expect(() => savePlatformLocale("vi")).not.toThrow();
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, "localStorage", descriptor);
      } else {
        Reflect.deleteProperty(globalThis, "localStorage");
      }
    }
  });
});
