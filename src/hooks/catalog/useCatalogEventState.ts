import { useEffect, useState } from "react";
import {
  hasEventDevicePin,
  OFFLINE_EVENT_ACCESS_UPDATED,
} from "../../lib/offline/eventAccess";
import {
  loadOfflineEventSession,
  OFFLINE_EVENT_UPDATED,
} from "../../lib/offline/offlineEvents";

export type CatalogEventState = {
  salesActive: boolean;
  adminPinRequired: boolean;
};

const inactiveEventState: CatalogEventState = {
  salesActive: false,
  adminPinRequired: false,
};

export function useCatalogEventState(shopId: string | undefined) {
  const [state, setState] = useState<CatalogEventState>(inactiveEventState);

  useEffect(() => {
    if (!shopId) {
      setState(inactiveEventState);
      return;
    }
    let active = true;
    const refresh = () => {
      void loadOfflineEventSession(shopId)
        .then((session) => {
          if (!active) return;
          setState({
            salesActive: session?.status === "active",
            adminPinRequired: Boolean(
              session &&
                session.status !== "closed" &&
                hasEventDevicePin(shopId),
            ),
          });
        })
        .catch(() => {
          if (active) setState(inactiveEventState);
        });
    };
    refresh();
    window.addEventListener(OFFLINE_EVENT_UPDATED, refresh);
    window.addEventListener(OFFLINE_EVENT_ACCESS_UPDATED, refresh);
    return () => {
      active = false;
      window.removeEventListener(OFFLINE_EVENT_UPDATED, refresh);
      window.removeEventListener(OFFLINE_EVENT_ACCESS_UPDATED, refresh);
    };
  }, [shopId]);

  return state;
}
