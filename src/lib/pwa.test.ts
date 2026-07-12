import { afterEach, describe, expect, it, vi } from "vitest";
import { enableOrderNotifications } from "./pwa";

describe("push configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("fails clearly when the public VAPID key is missing", async () => {
    vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "");
    await expect(enableOrderNotifications()).rejects.toThrow(/VITE_VAPID_PUBLIC_KEY/);
  });
});
