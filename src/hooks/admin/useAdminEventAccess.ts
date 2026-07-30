import { useCallback, useEffect, useState } from "react";
import {
  getEventAdminUnlockExpiresAt,
  hasEventDevicePin,
  OFFLINE_EVENT_ACCESS_UPDATED,
  verifyEventDevicePin,
} from "../../lib/offline/eventAccess";
import {
  loadOfflineEventSession,
  OFFLINE_EVENT_UPDATED,
} from "../../lib/offline/offlineEvents";

export type AdminEventAccessState =
  | { status: "checking" | "unlocked" }
  | { status: "locked"; eventName: string };

export function useAdminEventAccess(enabled: boolean, shopId: string) {
  const [state, setState] = useState<AdminEventAccessState>({
    status: "checking",
  });

  useEffect(() => {
    if (!enabled || !shopId) {
      setState({ status: "unlocked" });
      return;
    }

    let active = true;
    let refreshRequest = 0;
    let expiryTimer: number | undefined;
    const clearExpiryTimer = () => {
      if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
      expiryTimer = undefined;
    };
    const refresh = (showChecking = false) => {
      const requestId = ++refreshRequest;
      clearExpiryTimer();
      if (showChecking) setState({ status: "checking" });
      void loadOfflineEventSession(shopId)
        .then((session) => {
          if (!active || requestId !== refreshRequest) return;
          const pinConfigured = hasEventDevicePin(shopId);
          const unlockExpiresAt = pinConfigured
            ? getEventAdminUnlockExpiresAt(shopId)
            : null;
          const protectedSession = Boolean(
            session && session.status !== "closed" && pinConfigured,
          );
          const requiresPin = protectedSession && unlockExpiresAt === null;
          setState(
            requiresPin
              ? { status: "locked", eventName: session?.name ?? "" }
              : { status: "unlocked" },
          );
          if (protectedSession && unlockExpiresAt !== null) {
            expiryTimer = window.setTimeout(
              () => refresh(),
              Math.max(0, unlockExpiresAt - Date.now() + 25),
            );
          }
        })
        .catch(() => {
          if (!active || requestId !== refreshRequest) return;
          setState({ status: "unlocked" });
        });
    };
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ shopId?: string }>).detail;
      if (!detail?.shopId || detail.shopId === shopId) refresh();
    };

    refresh(true);
    window.addEventListener(OFFLINE_EVENT_UPDATED, handleUpdate);
    window.addEventListener(OFFLINE_EVENT_ACCESS_UPDATED, handleUpdate);
    return () => {
      active = false;
      refreshRequest += 1;
      clearExpiryTimer();
      window.removeEventListener(OFFLINE_EVENT_UPDATED, handleUpdate);
      window.removeEventListener(OFFLINE_EVENT_ACCESS_UPDATED, handleUpdate);
    };
  }, [enabled, shopId]);

  const unlock = useCallback(() => setState({ status: "unlocked" }), []);
  const verify = useCallback(
    (pin: string) => verifyEventDevicePin(shopId, pin),
    [shopId],
  );

  return { state, unlock, verify };
}
