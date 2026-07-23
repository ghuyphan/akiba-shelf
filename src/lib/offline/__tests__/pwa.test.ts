import { afterEach, describe, expect, it, vi } from "vitest";

const originalServiceWorker = Object.getOwnPropertyDescriptor(
  navigator,
  "serviceWorker",
);

function setServiceWorker(value: {
  ready: Promise<ServiceWorkerRegistration>;
}) {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value,
  });
}

describe("push configuration", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    vi.unstubAllEnvs();
    document.head.querySelector("link[data-matsuri-staff-pwa]")?.remove();
    window.history.replaceState(null, "", "/");
    if (originalServiceWorker) {
      Object.defineProperty(navigator, "serviceWorker", originalServiceWorker);
    } else {
      delete (navigator as unknown as { serviceWorker?: unknown })
        .serviceWorker;
    }
  });

  it("fails clearly when the public VAPID key is missing", async () => {
    vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "");
    const { enableOrderNotifications } = await import("../pwa");

    await expect(enableOrderNotifications()).rejects.toThrow(
      /VITE_VAPID_PUBLIC_KEY/,
    );
  });

  it("limits the installable app to staff routes", async () => {
    const { isStaffPwaPath } = await import("../pwa");

    expect(isStaffPwaPath("/admin")).toBe(true);
    expect(isStaffPwaPath("/dashboard")).toBe(true);
    expect(isStaffPwaPath("/dashboard/shops/new")).toBe(true);
    expect(isStaffPwaPath("/s/akiba-shelf")).toBe(false);
    expect(isStaffPwaPath("/auth")).toBe(false);
  });

  it("adds the manifest idempotently only on staff routes", async () => {
    const { configurePwa } = await import("../pwa");

    configurePwa("/admin");
    configurePwa("/dashboard");
    expect(document.head.querySelectorAll("link[rel='manifest']")).toHaveLength(
      1,
    );
    expect(document.head.querySelector("link[rel='manifest']")).toHaveAttribute(
      "href",
      "/manifest.webmanifest",
    );

    configurePwa("/s/akiba-shelf");
    expect(document.head.querySelector("link[rel='manifest']")).toBeNull();
  });

  it("captures an early install prompt before the workspace subscribes", async () => {
    window.history.replaceState(null, "", "/admin");
    const pwa = await import("../pwa");
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });

    window.dispatchEvent(event);

    expect(pwa.getPwaInstallState()).toBe("available");
  });

  it("does not claim an offline download is ready without an active worker", async () => {
    const { ensureOfflineNavigationReady } = await import("../pwa");

    await expect(ensureOfflineNavigationReady()).rejects.toThrow(
      /Offline navigation/,
    );
  });

  it("rejects when an installing worker becomes redundant", async () => {
    const worker = new EventTarget() as EventTarget & {
      state: ServiceWorkerState;
    };
    worker.state = "installing";
    const registration = {
      active: null,
      installing: worker,
      waiting: null,
    } as unknown as ServiceWorkerRegistration;
    setServiceWorker({ ready: Promise.resolve(registration) });
    const { ensureOfflineNavigationReady } = await import("../pwa");

    const readiness = ensureOfflineNavigationReady();
    await Promise.resolve();
    worker.state = "redundant";
    worker.dispatchEvent(new Event("statechange"));

    await expect(readiness).rejects.toThrow(/became unavailable/i);
  });

  it("times out when worker activation never completes", async () => {
    vi.useFakeTimers();
    const worker = new EventTarget() as EventTarget & {
      state: ServiceWorkerState;
    };
    worker.state = "installing";
    const registration = {
      active: null,
      installing: worker,
      waiting: null,
    } as unknown as ServiceWorkerRegistration;
    setServiceWorker({ ready: Promise.resolve(registration) });
    const { ensureOfflineNavigationReady } = await import("../pwa");

    const rejection = expect(ensureOfflineNavigationReady()).rejects.toThrow(
      /activation timed out/i,
    );
    await vi.advanceTimersByTimeAsync(15_000);
    await rejection;
  });
});
