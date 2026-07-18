import { lazy, type ComponentType } from "react";

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
          window.location.reload();
          // Return a never-resolving promise so React keeps showing the
          // Suspense fallback while the browser navigates away.
          return new Promise<{ default: T }>(() => {});
        }
        // Already reloaded once — clear the flag and let the error propagate
        // so the user sees a real error rather than an infinite reload loop.
        sessionStorage.removeItem(retryKey);
        throw error;
      }) as Promise<{ default: T }>),
  );
}
