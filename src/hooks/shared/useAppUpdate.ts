import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchReleaseMetadata,
  hasNewerRelease,
  type ReleaseMetadata,
} from "../../lib/release";
import { reloadForAppUpdate } from "../../utils/lazyWithRetry";

const INITIAL_CHECK_DELAY_MS = 3_000;
const UPDATE_CHECK_INTERVAL_MS = 10 * 60 * 1000;
const DISMISS_KEY = "matsuri-update-dismissed-release";

function wasDismissedForSession(release: string) {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === release;
  } catch {
    return false;
  }
}

export function useAppUpdate() {
  const [availableRelease, setAvailableRelease] =
    useState<ReleaseMetadata | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const inFlightCheck = useRef<Promise<void> | null>(null);
  const checkController = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  const checkForUpdate = useCallback(() => {
    if (document.visibilityState === "hidden" || !navigator.onLine) {
      return Promise.resolve();
    }
    if (inFlightCheck.current) return inFlightCheck.current;

    const controller = new AbortController();
    checkController.current = controller;
    const request = fetchReleaseMetadata(fetch, controller.signal)
      .then((metadata) => {
        if (!mounted.current || controller.signal.aborted) return;
        if (!metadata || !hasNewerRelease(metadata)) return;
        if (wasDismissedForSession(metadata.release)) return;
        setAvailableRelease((current) =>
          current?.release === metadata.release ? current : metadata,
        );
      })
      .finally(() => {
        if (checkController.current === controller) {
          checkController.current = null;
        }
        if (inFlightCheck.current === request) inFlightCheck.current = null;
      });
    inFlightCheck.current = request;
    return request;
  }, []);

  useEffect(() => {
    mounted.current = true;
    const initialTimer = window.setTimeout(
      () => void checkForUpdate(),
      INITIAL_CHECK_DELAY_MS,
    );
    const interval = window.setInterval(
      () => void checkForUpdate(),
      UPDATE_CHECK_INTERVAL_MS,
    );
    const handleFocus = () => void checkForUpdate();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void checkForUpdate();
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    let cancelled = false;
    let registration: ServiceWorkerRegistration | undefined;
    const handleWorkerUpdate = () => void checkForUpdate();
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker
        .getRegistration(import.meta.env.BASE_URL)
        .then((value) => {
          if (cancelled) return;
          registration = value;
          registration?.addEventListener("updatefound", handleWorkerUpdate);
        })
        .catch(() => undefined);
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        handleWorkerUpdate,
      );
    }

    return () => {
      mounted.current = false;
      cancelled = true;
      checkController.current?.abort();
      checkController.current = null;
      inFlightCheck.current = null;
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      registration?.removeEventListener("updatefound", handleWorkerUpdate);
      navigator.serviceWorker?.removeEventListener(
        "controllerchange",
        handleWorkerUpdate,
      );
    };
  }, [checkForUpdate]);

  const dismiss = useCallback(() => {
    if (!availableRelease) return;
    try {
      sessionStorage.setItem(DISMISS_KEY, availableRelease.release);
    } catch {
      // The in-memory dismissal still works when storage is unavailable.
    }
    setAvailableRelease(null);
  }, [availableRelease]);

  const applyUpdate = useCallback(async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    await reloadForAppUpdate();
    setIsUpdating(false);
  }, [isUpdating]);

  return {
    applyUpdate,
    dismiss,
    isUpdateAvailable: Boolean(availableRelease),
    isUpdating,
  };
}
