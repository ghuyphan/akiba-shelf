import { useEffect, useState } from "react";
import {
  Ban,
  CheckCircle2,
  Clock3,
  CloudOff,
  Eye,
  ShoppingBag,
} from "lucide-react";
import type { Order } from "../../../types/catalog";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";
import { formatRelativeTime, formatVnd } from "../../../utils/format";
import { StatusPill, type StatusPillTone } from "../../ui/StatusPill";
import { SwipeConfirmButton } from "./SwipeConfirmButton";

type OrderCardProps = {
  order: Order;
  isConfirming: boolean;
  isCancelling: boolean;
  isFulfillmentBusy: boolean;
  onConfirm: () => Promise<boolean>;
  onCancel: () => void;
  onDetails: () => void;
  onFulfillment: (status: "ready" | "picked_up") => void;
};

function formatAdminRelativeTime(value: string | Date, locale: "en" | "vi") {
  if (locale === "en") return formatRelativeTime(value);
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 1000),
  );
  if (seconds < 60) return "Vừa xong";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

function formatExpiry(value: string, locale: "en" | "vi") {
  const seconds = Math.ceil((new Date(value).getTime() - Date.now()) / 1000);
  if (seconds <= 0)
    return {
      text: locale === "vi" ? "Đang cập nhật hết hạn" : "Expiry updating",
      urgent: true,
    };
  const minutes = Math.ceil(seconds / 60);
  return {
    text: locale === "vi" ? `Còn ${minutes} phút` : `Expires in ${minutes}m`,
    urgent: minutes <= 2,
  };
}

export function OrderCard({
  order,
  isConfirming,
  isCancelling,
  isFulfillmentBusy,
  onConfirm,
  onCancel,
  onDetails,
  onFulfillment,
}: OrderCardProps) {
  const [elapsedTime, setElapsedTime] = useState("");
  const [expiry, setExpiry] = useState<{
    text: string;
    urgent: boolean;
  } | null>(null);
  const { locale, t } = usePlatformI18n();
  const hasScrollableItems = (order.order_items?.length ?? 0) > 3;
  useEffect(() => {
    function updateTime() {
      setElapsedTime(formatAdminRelativeTime(order.created_at, locale));
      setExpiry(
        order.status === "pending" && order.expires_at
          ? formatExpiry(order.expires_at, locale)
          : null,
      );
    }
    updateTime();
    const interval = window.setInterval(updateTime, 15000);
    return () => window.clearInterval(interval);
  }, [locale, order.created_at, order.expires_at, order.status]);

  const statusIcon =
    order.status === "confirmed" ? (
      <CheckCircle2 size={14} />
    ) : order.status === "cancelled" || order.status === "expired" ? (
      <Ban size={14} />
    ) : (
      <Clock3 size={14} />
    );
  const statusTone: StatusPillTone =
    order.status === "confirmed"
      ? "success"
      : order.status === "cancelled"
        ? "danger"
        : order.status === "expired"
          ? "warning"
          : "pending";
  const unitCount =
    order.order_items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const fulfillmentStatus =
    order.fulfillment_status ??
    (order.status === "confirmed" ? "preparing" : "unfulfilled");
  const nextFulfillment =
    fulfillmentStatus === "preparing"
      ? "ready"
      : fulfillmentStatus === "ready"
        ? "picked_up"
        : null;
  const fulfillmentTone: StatusPillTone =
    fulfillmentStatus === "ready"
      ? "success"
      : fulfillmentStatus === "picked_up"
        ? "info"
        : fulfillmentStatus === "preparing"
          ? "pending"
          : "neutral";
  return (
    <article className={`admin-order-card status-${order.status}`}>
      <header>
        <div>
          <span className="admin-order-code">{order.order_code}</span>
          <span className="admin-order-time">
            <Clock3 size={13} /> {elapsedTime}
          </span>
          {expiry && (
            <span
              className={`admin-order-expiry ${expiry.urgent ? "urgent" : ""}`}
            >
              {expiry.text}
            </span>
          )}
        </div>
        <StatusPill
          className={`admin-order-status ${order.status}`}
          tone={statusTone}
          icon={statusIcon}
        >
          {t(order.status)}
        </StatusPill>
      </header>
      {order.customer_name && (
        <div className="admin-order-customer">
          <span>{t("Pickup name")}</span>
          <strong>{order.customer_name}</strong>
        </div>
      )}
      <div
        className={`admin-order-items ${hasScrollableItems ? "is-scrollable" : ""}`}
        tabIndex={hasScrollableItems ? 0 : undefined}
        aria-label={hasScrollableItems ? t("Order items") : undefined}
      >
        {order.order_items?.map((item) => {
          const image = item.product?.images?.find(Boolean);
          return (
            <div key={item.id} className="admin-order-item">
              {image ? (
                <img src={image} alt="" />
              ) : (
                <span className="admin-order-item-placeholder">
                  <ShoppingBag size={15} />
                </span>
              )}
              <div>
                <strong>{item.product?.name || t("Unknown product")}</strong>
                <small>{item.product?.item_code || t("No code")}</small>
              </div>
              <b>{item.quantity}×</b>
            </div>
          );
        })}
      </div>
      <footer>
        <div>
          {Boolean(order.discount_amount) && (
            <span className="admin-order-discount">
              {t("Promotion savings")} · −
              {formatVnd(order.discount_amount ?? 0)}
            </span>
          )}
          <span>
            {t("Total")} · {t("{{count}} units", { count: unitCount })}
          </span>
        </div>
        <strong>{formatVnd(order.total_amount)}</strong>
      </footer>
      {order.source === "offline_event" && (
        <div className="admin-order-event-source">
          <CloudOff size={13} />
          <span>{order.offline_event_name || t("Event sale")}</span>
        </div>
      )}
      {order.status === "pending" && order.source === "offline_event" ? (
        <div className="admin-order-event-note">
          {t("Resolve this order on the designated Event Mode device.")}
        </div>
      ) : order.status === "pending" ? (
        <div className="admin-order-actions">
          <SwipeConfirmButton
            onConfirm={onConfirm}
            isConfirming={isConfirming}
          />
          <button
            type="button"
            className="admin-cancel-order"
            onClick={onCancel}
            disabled={isConfirming || isCancelling}
          >
            <Ban size={15} />
            {isCancelling ? t("Cancelling…") : t("Cancel and release stock")}
          </button>
        </div>
      ) : order.status === "confirmed" ? (
        <div className="admin-order-fulfillment">
          <StatusPill
            className={`admin-fulfillment-status ${fulfillmentStatus}`}
            tone={fulfillmentTone}
          >
            {t(fulfillmentStatus)}
          </StatusPill>
          {order.source !== "offline_event" && nextFulfillment && (
            <button
              type="button"
              disabled={isFulfillmentBusy}
              onClick={() => onFulfillment(nextFulfillment)}
            >
              {t(nextFulfillment === "ready" ? "Mark ready" : "Mark picked up")}
            </button>
          )}
        </div>
      ) : null}
      <button
        type="button"
        className="admin-order-details-trigger"
        onClick={onDetails}
      >
        <Eye size={14} />
        {t("Order details")}
      </button>
    </article>
  );
}
