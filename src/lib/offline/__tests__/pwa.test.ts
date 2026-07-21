import { afterEach, describe, expect, it, vi } from "vitest";
import {
  configurePwa,
  ensureOfflineNavigationReady,
  enableOrderNotifications,
  isStaffPwaPath,
} from "../pwa";

describe("push configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    document.head.querySelector("link[data-matsuri-staff-pwa]")?.remove();
  });

  it("fails clearly when the public VAPID key is missing", async () => {
    vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "");
    await expect(enableOrderNotifications()).rejects.toThrow(
      /VITE_VAPID_PUBLIC_KEY/,
    );
  });

  it("limits the installable app to staff routes", () => {
    expect(isStaffPwaPath("/admin")).toBe(true);
    expect(isStaffPwaPath("/dashboard")).toBe(true);
    expect(isStaffPwaPath("/dashboard/shops/new")).toBe(true);
    expect(isStaffPwaPath("/s/akiba-shelf")).toBe(false);
    expect(isStaffPwaPath("/auth")).toBe(false);
  });

  it("adds the manifest link idempotently", () => {
    configurePwa();
    expect(document.head.querySelector("link[rel='manifest']")).toHaveAttribute(
      "href",
      "/manifest.webmanifest",
    );

    configurePwa();
    expect(document.head.querySelector("link[rel='manifest']")).not.toBeNull();
  });

  it("does not claim an offline download is ready without an active worker", async () => {
    await expect(ensureOfflineNavigationReady()).rejects.toThrow(
      /Offline navigation/,
    );
  });
});
