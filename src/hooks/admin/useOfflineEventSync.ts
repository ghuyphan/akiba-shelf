import { useCallback, useEffect, useRef } from "react";
import { syncOfflineEventOrders } from "../../lib/api/offlineEvents";
import { getErrorMessage } from "../../lib/errors";
import {
  listOfflineEventOrders,
  markOfflineEventOrdersSynced,
} from "../../lib/offline/offlineEvents";
import type { OfflineEventSession } from "../../types/catalog";

type UseOfflineEventSyncOptions = {
  session: OfflineEventSession | null;
  online: boolean;
  unsyncedCount: number;
  busy: boolean;
  reloadLocal: () => Promise<unknown>;
  translate: (value: string) => string;
  showSuccess: (message: string) => void;
  showError: (message: string, title: string) => void;
  setBusy: (busy: boolean) => void;
};

export function useOfflineEventSync({
  session,
  online,
  unsyncedCount,
  busy,
  reloadLocal,
  translate,
  showSuccess,
  showError,
  setBusy,
}: UseOfflineEventSyncOptions) {
  const syncPromiseRef = useRef<Promise<boolean> | null>(null);

  const syncOrders = useCallback(async () => {
    if (!session || session.status !== "active" || !online) return false;
    if (syncPromiseRef.current) return syncPromiseRef.current;
    const request = (async () => {
      setBusy(true);
      try {
        const latestOrders = await listOfflineEventOrders(session.id);
        const pendingSync = latestOrders.filter((order) => !order.syncedAt);
        if (!pendingSync.length) return true;
        const acknowledgements = await syncOfflineEventOrders(
          session,
          pendingSync,
        );
        await markOfflineEventOrdersSynced(session, acknowledgements);
        await reloadLocal();
        showSuccess(translate("Offline orders synchronized."));
        return true;
      } catch (error) {
        showError(
          translate(
            getErrorMessage(error, "Could not synchronize offline orders."),
          ),
          translate("Sync failed"),
        );
        return false;
      } finally {
        syncPromiseRef.current = null;
        setBusy(false);
      }
    })();
    syncPromiseRef.current = request;
    return request;
  }, [
    online,
    reloadLocal,
    session,
    setBusy,
    showError,
    showSuccess,
    translate,
  ]);

  const waitForSync = useCallback(async () => {
    if (syncPromiseRef.current) await syncPromiseRef.current;
  }, []);

  useEffect(() => {
    if (
      !online ||
      busy ||
      !session ||
      session.status !== "active" ||
      !unsyncedCount
    )
      return;
    void syncOrders();
  }, [busy, online, session, syncOrders, unsyncedCount]);

  return { syncOrders, waitForSync };
}
