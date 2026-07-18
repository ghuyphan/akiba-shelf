import { afterEach, describe, expect, it, vi } from "vitest";
import {
  configurePwaForPath,
  enableOrderNotifications,
  isStaffPwaPath,
  shouldRegisterPwa,
} from "./pwa";

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

  it("registers the worker for staff routes and the simulator host", () => {
    expect(shouldRegisterPwa("/admin")).toBe(true);
    expect(shouldRegisterPwa("/dashboard/shops/new")).toBe(true);
    expect(shouldRegisterPwa("/s/akiba-shelf")).toBe(false);
    expect(shouldRegisterPwa("/s/akiba-shelf/play")).toBe(true);
  });

  it("adds and removes the manifest as routes cross the staff boundary", () => {
    configurePwaForPath("/dashboard");
    expect(document.head.querySelector("link[rel='manifest']")).toHaveAttribute(
      "href",
      "/manifest.webmanifest",
    );

    configurePwaForPath("/s/akiba-shelf");
    expect(document.head.querySelector("link[rel='manifest']")).toBeNull();
  });
});
