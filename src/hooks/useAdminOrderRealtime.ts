import { useCallback, useEffect, useRef } from "react";
import { subscribeToAdminOrderChanges } from "../lib/realtime";

export function useAdminOrderRealtime({
  enabled,
  shopId,
  onRefresh,
  onError,
}: {
  enabled: boolean;
  shopId: string;
  onRefresh: () => Promise<void>;
  onError: (error: unknown) => void;
}) {
  const refreshRef = useRef(onRefresh);
  const errorRef = useRef(onError);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    refreshRef.current = onRefresh;
    errorRef.current = onError;
  }, [onRefresh, onError]);

  const scheduleRefresh = useCallback(() => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      refreshRef.current().catch((error) => errorRef.current(error));
    }, 200);
  }, []);

  useEffect(() => {
    if (!enabled || !shopId) return undefined;
    const unsubscribe = subscribeToAdminOrderChanges(shopId, scheduleRefresh);
    return () => {
      window.clearTimeout(timerRef.current);
      unsubscribe();
    };
  }, [enabled, shopId, scheduleRefresh]);

  return scheduleRefresh;
}
