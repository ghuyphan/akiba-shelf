import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearEventDevicePin,
  getEventAdminUnlockExpiresAt,
  hasEventDevicePin,
  isEventAdminUnlocked,
  lockEventAdmin,
  setEventDevicePin,
  verifyEventDevicePin,
} from "../eventAccess";

const shopId = "70000000-0000-4000-8000-000000000001";

describe("offline event tablet access", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    lockEventAdmin(shopId);
    vi.restoreAllMocks();
  });

  it("stores a derived PIN and unlocks only after a correct verification", async () => {
    await setEventDevicePin(shopId, "123456");

    expect(hasEventDevicePin(shopId)).toBe(true);
    const key = localStorage.key(0);
    expect(key).not.toBeNull();
    expect(localStorage.getItem(key!)).not.toContain("123456");

    lockEventAdmin(shopId);
    expect(isEventAdminUnlocked(shopId)).toBe(false);
    expect(await verifyEventDevicePin(shopId, "654321")).toEqual({
      ok: false,
      blockedUntil: undefined,
    });
    expect(isEventAdminUnlocked(shopId)).toBe(false);
    expect(await verifyEventDevicePin(shopId, "123456")).toEqual({ ok: true });
    expect(isEventAdminUnlocked(shopId)).toBe(true);
  });

  it("rejects PINs that are not exactly six digits", async () => {
    await expect(setEventDevicePin(shopId, "12345")).rejects.toThrow(
      "exactly 6 digits",
    );
    await expect(verifyEventDevicePin(shopId, "abcdef")).rejects.toThrow(
      "exactly 6 digits",
    );
    expect(hasEventDevicePin(shopId)).toBe(false);
  });

  it("temporarily blocks verification after five failed attempts", async () => {
    const now = 1_900_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    await setEventDevicePin(shopId, "123456");
    lockEventAdmin(shopId);

    for (let attempt = 0; attempt < 4; attempt += 1)
      expect(await verifyEventDevicePin(shopId, "000000")).toEqual({
        ok: false,
        blockedUntil: undefined,
      });

    const fifth = await verifyEventDevicePin(shopId, "000000");
    if (fifth.ok) throw new Error("Expected the fifth attempt to be blocked.");
    expect(fifth.blockedUntil).toBe(now + 30_000);
    expect(await verifyEventDevicePin(shopId, "123456")).toEqual(fifth);

    vi.mocked(Date.now).mockReturnValue(now + 30_001);
    expect(await verifyEventDevicePin(shopId, "123456")).toEqual({ ok: true });
  });

  it("expires and explicitly clears the temporary unlock", async () => {
    const now = 1_900_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    await setEventDevicePin(shopId, "123456");
    expect(isEventAdminUnlocked(shopId)).toBe(true);
    expect(getEventAdminUnlockExpiresAt(shopId)).toBe(now + 5 * 60_000);

    vi.mocked(Date.now).mockReturnValue(now + 5 * 60_000 + 1);
    expect(isEventAdminUnlocked(shopId)).toBe(false);
    expect(getEventAdminUnlockExpiresAt(shopId)).toBeNull();

    clearEventDevicePin(shopId);
    expect(hasEventDevicePin(shopId)).toBe(false);
  });

  it("treats malformed local records as unconfigured", async () => {
    await setEventDevicePin(shopId, "123456");
    const key = localStorage.key(0);
    expect(key).not.toBeNull();
    localStorage.setItem(
      key!,
      JSON.stringify({
        version: 1,
        salt: "not-base64",
        hash: "also-not-base64",
        iterations: 120_000,
        failedAttempts: 0,
        updatedAt: new Date().toISOString(),
      }),
    );

    expect(hasEventDevicePin(shopId)).toBe(false);
    expect(await verifyEventDevicePin(shopId, "123456")).toEqual({ ok: false });
  });
});
