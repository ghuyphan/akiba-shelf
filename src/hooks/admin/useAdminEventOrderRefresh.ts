import { useEffect, useRef } from "react";
import { getErrorMessage, isSessionNoise } from "../../lib/errors";
import { OFFLINE_EVENT_UPDATED } from "../../lib/offline/offlineEvents";

export function useAdminEventOrderRefresh({
  enabled,
  ready,
  active,
  shopId,
  reload,
  onError,
}: {
  enabled: boolean;
  ready: boolean;
  active: boolean;
  shopId: string;
  reload: (refreshCounts?: boolean) => Promise<void>;
  onError: (message: string, title: string) => void;
}) {
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!enabled || !ready || !active) return;
    let timer: number | undefined;
    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        reload(true).catch((error) => {
          if (isSessionNoise(error)) return;
          onErrorRef.current(
            getErrorMessage(error, "Could not refresh orders."),
            "Refresh failed",
          );
        });
      }, 200);
    };
    const handleEventUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ shopId?: string }>).detail;
      if (!detail?.shopId || detail.shopId === shopId) refresh();
    };
    window.addEventListener(OFFLINE_EVENT_UPDATED, handleEventUpdate);
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    const interval = window.setInterval(refresh, 15_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener(OFFLINE_EVENT_UPDATED, handleEventUpdate);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [active, enabled, ready, reload, shopId]);
}
