import { afterEach, describe, expect, it, vi } from "vitest";
import { reloadForAppUpdate } from "../lazyWithRetry";

const originalServiceWorker = Object.getOwnPropertyDescriptor(
  navigator,
  "serviceWorker",
);

describe("stale deployment recovery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    if (originalServiceWorker) {
      Object.defineProperty(navigator, "serviceWorker", originalServiceWorker);
    } else {
      delete (navigator as unknown as { serviceWorker?: unknown })
        .serviceWorker;
    }
  });

  it("updates the service worker before reloading the app", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const getRegistration = vi.fn().mockResolvedValue({
      active: {},
      installing: null,
      waiting: null,
      update,
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { getRegistration },
    });
    const reload = vi.fn();

    await reloadForAppUpdate(reload);

    expect(getRegistration).toHaveBeenCalledWith("/");
    expect(update).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
  });

  it("activates a waiting deployment before reloading", async () => {
    const serviceWorker = new EventTarget() as EventTarget & {
      getRegistration: ReturnType<typeof vi.fn>;
    };
    const postMessage = vi.fn(() => {
      serviceWorker.dispatchEvent(new Event("controllerchange"));
    });
    const waiting = Object.assign(new EventTarget(), {
      state: "installed" as ServiceWorkerState,
      postMessage,
    });
    const registration = {
      active: {},
      installing: null,
      waiting,
      update: vi.fn().mockResolvedValue(undefined),
    } as unknown as ServiceWorkerRegistration;
    serviceWorker.getRegistration = vi.fn().mockResolvedValue(registration);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: serviceWorker,
    });
    const reload = vi.fn();

    await reloadForAppUpdate(reload);

    expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(reload).toHaveBeenCalledOnce();
  });

  it("still reloads when the worker update fails", async () => {
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistration: vi.fn().mockRejectedValue(new Error("offline")),
      },
    });
    const reload = vi.fn();

    await reloadForAppUpdate(reload);

    expect(reload).toHaveBeenCalledOnce();
  });
});
