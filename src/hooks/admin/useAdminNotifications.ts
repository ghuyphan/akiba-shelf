import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  getOrderNotificationStatus,
  retryOrderNotification,
} from "../../lib/api/orders";
import { getErrorMessage, isSessionNoise } from "../../lib/errors";
import { usePlatformI18n } from "../../lib/i18n/platformI18n";
import { reportError } from "../../lib/observability";
import type { OrderNotificationStatus } from "../../types/catalog";
import { useToast } from "../../components/ui/ToastProvider";

export function useAdminNotifications({
  enabled,
  shopId,
}: {
  enabled: boolean;
  shopId: string;
}) {
  const [statuses, setStatuses] = useState<OrderNotificationStatus[]>([]);
  const requestRef = useRef(0);
  const activeShopIdRef = useRef(shopId);
  const toast = useToast();
  const { t } = usePlatformI18n();

  useLayoutEffect(() => {
    activeShopIdRef.current = shopId;
    requestRef.current += 1;
    setStatuses([]);
  }, [shopId]);

  const refresh = useCallback(async () => {
    const requestId = ++requestRef.current;
    const requestedShopId = shopId;
    const next = await getOrderNotificationStatus(requestedShopId);
    if (
      requestId === requestRef.current &&
      requestedShopId === activeShopIdRef.current
    ) {
      setStatuses(next);
    }
  }, [shopId]);

  useEffect(() => {
    if (!enabled) return;
    const runRefresh = () => {
      void refresh().catch((error) => {
        if (!isSessionNoise(error)) {
          reportError(error, {
            stage: "admin_notification_status",
            shopId,
          });
        }
      });
    };
    runRefresh();
    const interval = window.setInterval(runRefresh, 30_000);
    window.addEventListener("focus", runRefresh);
    window.addEventListener("online", runRefresh);
    return () => {
      requestRef.current += 1;
      window.clearInterval(interval);
      window.removeEventListener("focus", runRefresh);
      window.removeEventListener("online", runRefresh);
    };
  }, [enabled, refresh, shopId]);

  const retry = useCallback(
    async (orderId: string) => {
      const requestedShopId = shopId;
      try {
        const retried = await retryOrderNotification(
          requestedShopId,
          orderId,
          "admin_attention_panel",
        );
        if (requestedShopId !== activeShopIdRef.current) return false;
        await refresh();
        if (requestedShopId !== activeShopIdRef.current) return false;
        if (retried) {
          toast.success(t("Order alert queued for another delivery attempt."));
        } else {
          toast.info(
            t(
              "This alert is no longer eligible for retry. Its status was refreshed.",
            ),
          );
        }
        return retried;
      } catch (error) {
        if (requestedShopId === activeShopIdRef.current) {
          toast.error(
            t(getErrorMessage(error, "Could not retry this order alert.")),
            t("Retry unavailable"),
          );
        }
        throw error;
      }
    },
    [refresh, shopId, t, toast],
  );

  return { statuses, retry, refresh };
}
