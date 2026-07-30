import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPushRegistrationStatus, unregisterPushSubscription } from "../push";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("../../supabase", () => ({
  isSupabaseConfigured: true,
  supabase: { functions: { invoke: mocks.invoke } },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("push Edge Function contracts", () => {
  it("parses exact status and unregister responses", async () => {
    mocks.invoke
      .mockResolvedValueOnce({ data: { enabled: true }, error: null })
      .mockResolvedValueOnce({
        data: { outcome: "unregistered", unsubscribe: true },
        error: null,
      });

    await expect(
      getPushRegistrationStatus("shop-1", "https://push.example.test/1"),
    ).resolves.toBe(true);
    await expect(
      unregisterPushSubscription("shop-1", "https://push.example.test/1"),
    ).resolves.toBe(true);
  });

  it("rejects malformed success responses", async () => {
    mocks.invoke.mockResolvedValueOnce({
      data: { outcome: "ok", enabled: "yes" },
      error: null,
    });

    await expect(
      getPushRegistrationStatus("shop-1", "https://push.example.test/1"),
    ).rejects.toThrow();
  });
});
