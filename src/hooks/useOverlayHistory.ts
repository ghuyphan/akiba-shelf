import { useCallback, useEffect, useRef } from "react";

const OVERLAY_STATE_KEY = "__akibaOverlay";
let nextOverlayId = 0;

type OverlayHistoryState = {
  token: string;
};

function getOverlayState(): OverlayHistoryState | undefined {
  const state = window.history.state as Record<string, unknown> | null;
  const overlay = state?.[OVERLAY_STATE_KEY];
  if (!overlay || typeof overlay !== "object") return undefined;
  const token = (overlay as Record<string, unknown>).token;
  return typeof token === "string" ? { token } : undefined;
}

export function useOverlayHistory(
  open: boolean,
  onClose: () => void,
  enabled = true,
  canClose = true,
) {
  const tokenRef = useRef(`overlay-${++nextOverlayId}`);
  const entryActiveRef = useRef(false);
  const previousOpenRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const canCloseRef = useRef(canClose);
  onCloseRef.current = onClose;
  canCloseRef.current = canClose;

  useEffect(() => {
    if (!enabled) return;

    const handlePopState = () => {
      if (!entryActiveRef.current) return;
      if (getOverlayState()?.token === tokenRef.current) return;
      if (!canCloseRef.current) {
        const currentState =
          window.history.state && typeof window.history.state === "object"
            ? (window.history.state as Record<string, unknown>)
            : {};
        window.history.pushState(
          {
            ...currentState,
            [OVERLAY_STATE_KEY]: { token: tokenRef.current },
          },
          "",
          window.location.href,
        );
        return;
      }
      entryActiveRef.current = false;
      onCloseRef.current();
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      previousOpenRef.current = open;
      return;
    }

    const wasOpen = previousOpenRef.current;
    previousOpenRef.current = open;

    if (open && !wasOpen && !entryActiveRef.current) {
      const currentState = window.history.state && typeof window.history.state === "object"
        ? window.history.state as Record<string, unknown>
        : {};
      window.history.pushState(
        { ...currentState, [OVERLAY_STATE_KEY]: { token: tokenRef.current } },
        "",
        window.location.href,
      );
      entryActiveRef.current = true;
      return;
    }

    if (!open && wasOpen && entryActiveRef.current) {
      const ownsCurrentEntry = getOverlayState()?.token === tokenRef.current;
      entryActiveRef.current = false;
      if (ownsCurrentEntry) window.history.back();
    }
  }, [enabled, open]);

  return useCallback(() => {
    if (!canCloseRef.current) return;
    if (!enabled || !entryActiveRef.current || getOverlayState()?.token !== tokenRef.current) {
      onCloseRef.current();
      return;
    }
    window.history.back();
  }, [enabled]);
}
