import { describe, expect, it, vi } from "vitest";
import { subscribeToMediaQuery } from "../mediaQuery";

describe("subscribeToMediaQuery", () => {
  it("falls back to the legacy Safari listener API", () => {
    const addListener = vi.fn();
    const removeListener = vi.fn();
    const media = {
      matches: false,
      media: "(max-width: 760px)",
      onchange: null,
      addListener,
      removeListener,
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
    const listener = vi.fn();

    const unsubscribe = subscribeToMediaQuery(media, listener);
    expect(addListener).toHaveBeenCalledWith(listener);

    unsubscribe();
    expect(removeListener).toHaveBeenCalledWith(listener);
  });
});
