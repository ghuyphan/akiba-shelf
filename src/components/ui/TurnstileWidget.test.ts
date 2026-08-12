import { afterEach, describe, expect, it, vi } from "vitest";
import { loadTurnstile } from "./TurnstileWidget";

describe("loadTurnstile", () => {
  afterEach(() => {
    document.getElementById("matsuri-turnstile-api")?.remove();
    Reflect.deleteProperty(window, "turnstile");
    vi.restoreAllMocks();
  });

  it("removes a failed script so the next attempt can reload it", async () => {
    const first = loadTurnstile();
    const failedScript = document.getElementById("matsuri-turnstile-api");
    expect(failedScript).toBeInstanceOf(HTMLScriptElement);

    failedScript?.dispatchEvent(new Event("error"));
    await expect(first).rejects.toThrow("Turnstile could not be loaded");
    expect(document.getElementById("matsuri-turnstile-api")).toBeNull();

    const second = loadTurnstile();
    const replacement = document.getElementById("matsuri-turnstile-api");
    expect(replacement).toBeInstanceOf(HTMLScriptElement);
    expect(replacement).not.toBe(failedScript);

    window.turnstile = {
      render: vi.fn(() => "widget-1"),
      remove: vi.fn(),
      reset: vi.fn(),
    };
    replacement?.dispatchEvent(new Event("load"));
    await expect(second).resolves.toBe(window.turnstile);
  });
});
