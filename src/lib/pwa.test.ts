import { describe, expect, it } from "vitest";
import { enableOrderNotifications } from "./pwa";

describe("push configuration", () => {
  it("fails clearly when the public VAPID key is missing", async () => { await expect(enableOrderNotifications()).rejects.toThrow(/VITE_VAPID_PUBLIC_KEY/); });
});
