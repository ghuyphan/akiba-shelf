import { lazy, type ComponentType } from "react";

const WORKER_UPDATE_TIMEOUT_MS = 8_000;

async function activateUpdatedWorker(registration: ServiceWorkerRegistration) {
  const worker = registration.installing ?? registration.waiting;
  if (!worker || worker.state === "activated") return;

  await new Promise<void>((resolve) => {
    const cleanup = () => {
      window.clearTimeout(timeout);
      worker.removeEventListener("statechange", handleStateChange);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
    };
    const finish = () => {
      cleanup();
      resolve();
    };
    const handleControllerChange = () => finish();
    const handleStateChange = () => {
      if (worker.state === "installed") {
        registration.waiting?.postMessage({ type: "SKIP_WAITING" });
      } else if (worker.state === "activated" || worker.state === "redundant") {
        finish();
      }
    };
    const timeout = window.setTimeout(finish, WORKER_UPDATE_TIMEOUT_MS);

    worker.addEventListener("statechange", handleStateChange);
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange,
      { once: true },
    );
    handleStateChange();
  });
}

/** Refreshes the service worker first so a reload cannot be served the stale
 * app shell that referenced the missing chunk. */
export async function reloadForAppUpdate(
  reload: () => void = () => window.location.reload(),
) {
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration(
        import.meta.env.BASE_URL,
      );
      if (registration) {
        await registration.update();
        await activateUpdatedWorker(registration);
      }
    }
  } catch {
    // A normal reload still gives non-PWA visitors and transient failures a retry.
  }
  reload();
}

/**
 * Wraps `React.lazy` so that a failed dynamic import (typically caused by stale
 * chunk hashes after a new deployment) triggers a single hard reload instead of
 * crashing to a blank page.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  chunkName: string,
  factory: () => Promise<{ default: T }>,
) {
  const retryKey = `chunk-reload:${chunkName}`;
  return lazy(() =>
    (factory()
      .then((module) => {
        sessionStorage.removeItem(retryKey);
        return module;
      })
      .catch((error: unknown) => {
        if (!sessionStorage.getItem(retryKey)) {
          sessionStorage.setItem(retryKey, "1");
          return reloadForAppUpdate().then(
            // Keep showing the Suspense fallback while the browser navigates.
            () => new Promise<{ default: T }>(() => {}),
          );
        }
        // Already reloaded once — clear the flag and let the error propagate
        // so the user sees a real error rather than an infinite reload loop.
        sessionStorage.removeItem(retryKey);
        throw error;
      }) as Promise<{ default: T }>),
  );
}
