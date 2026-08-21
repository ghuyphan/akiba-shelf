import { useCallback, useEffect, useRef, useState } from "react";

const SPOTLIGHT_ATTR = "data-guide-spotlight";
const SPOTLIGHT_CLASS = "guide-spotlight-pulse";
const SPOTLIGHT_DURATION_MS = 3200;
const MAX_SEARCH_TIME_MS = 2000;
const POLL_INTERVAL_MS = 80;

export const GUIDE_SPOTLIGHT_EVENT = "guide-spotlight-request";

/**
 * Dispatches a spotlight request event so nested workspaces (e.g. StorefrontDesigner)
 * can automatically select appropriate tabs/modules.
 */
export function dispatchSpotlightRequest(targetKey: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(GUIDE_SPOTLIGHT_EVENT, { detail: { targetKey } }),
  );
}

/**
 * Focuses and highlights a target element by its data-guide-spotlight key.
 */
export function spotlightElement(targetKey: string): boolean {
  if (typeof document === "undefined") return false;
  const selector = `[${SPOTLIGHT_ATTR}="${targetKey}"]`;
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return false;

  el.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "nearest",
  });

  // Remove class first to reset any running animation
  el.classList.remove(SPOTLIGHT_CLASS);
  // Force reflow
  void el.offsetWidth;
  el.classList.add(SPOTLIGHT_CLASS);

  let timer: number | null = null;
  const cleanup = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    el.classList.remove(SPOTLIGHT_CLASS);
    window.removeEventListener("pointerdown", cleanup);
    window.removeEventListener("keydown", cleanup);
  };

  timer = window.setTimeout(cleanup, SPOTLIGHT_DURATION_MS);
  window.addEventListener("pointerdown", cleanup, { once: true });
  window.addEventListener("keydown", cleanup, { once: true });

  return true;
}

export function useGuideSpotlight() {
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);
  const searchStartTimeRef = useRef<number>(0);
  const pollTimerRef = useRef<number | null>(null);

  const triggerSpotlight = useCallback((targetKey: string) => {
    dispatchSpotlightRequest(targetKey);
    // Try immediate spotlight
    if (spotlightElement(targetKey)) {
      setPendingTarget(null);
      return;
    }
    // Queue for when view renders
    searchStartTimeRef.current = Date.now();
    setPendingTarget(targetKey);
  }, []);

  useEffect(() => {
    if (!pendingTarget) return;

    // Notify any newly mounted components of the target
    dispatchSpotlightRequest(pendingTarget);

    function pollForTarget() {
      if (!pendingTarget) return;
      if (spotlightElement(pendingTarget)) {
        setPendingTarget(null);
        return;
      }
      if (Date.now() - searchStartTimeRef.current > MAX_SEARCH_TIME_MS) {
        setPendingTarget(null);
        return;
      }
      pollTimerRef.current = window.setTimeout(pollForTarget, POLL_INTERVAL_MS);
    }

    pollTimerRef.current = window.setTimeout(pollForTarget, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current !== null) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, [pendingTarget]);

  return { triggerSpotlight };
}
