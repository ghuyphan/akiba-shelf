import type { Order } from "../../../types/catalog";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";
import { formatVnd } from "../../../utils/format";
import { Modal } from "../../ui/Modal";

type OrderDetailsModalProps = {
  order: Order | null;
  onClose: () => void;
};

export function OrderDetailsModal({ order, onClose }: OrderDetailsModalProps) {
  const { locale, t } = usePlatformI18n();
  if (!order) return null;
  const date = (value?: string | null) =>
    value
      ? new Date(value).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")
      : t("Not recorded");
  const payment =
    order.source === "offline_event"
      ? t(order.payment_method === "cash" ? "Cash" : "VietQR")
      : t("Online QR checkout");
  const actor =
    order.status === "confirmed"
      ? order.confirmed_by_email
      : order.status === "cancelled"
        ? order.cancelled_by_email
        : null;
  return (
    <Modal
      title={`${t("Order details")} · ${order.order_code}`}
      isOpen
      onClose={onClose}
      wide
      mobileSheet
      closeLabel={t("Close modal")}
      appearance="admin"
    >
      <div className="admin-order-details">
        <div className="admin-order-details-grid">
          <div>
            <span>{t("Pickup name")}</span>
            <strong>{order.customer_name || t("Walk-in customer")}</strong>
          </div>
          <div>
            <span>{t("Payment")}</span>
            <strong>{payment}</strong>
          </div>
          <div>
            <span>{t("Created")}</span>
            <strong>{date(order.created_at)}</strong>
          </div>
          <div>
            <span>{t("Handled by")}</span>
            <strong>
              {actor ||
                t(
                  order.status === "expired" ? "System expiry" : "Not recorded",
                )}
            </strong>
          </div>
          <div>
            <span>{t("Payment updated")}</span>
            <strong>
              {date(
                order.confirmed_at || order.cancelled_at || order.expired_at,
              )}
            </strong>
          </div>
          <div>
            <span>{t("Fulfilment updated")}</span>
            <strong>{date(order.fulfillment_updated_at)}</strong>
          </div>
          <div>
            <span>{t("Fulfilment handled by")}</span>
            <strong>
              {order.fulfillment_updated_by_email || t("Not recorded")}
            </strong>
          </div>
        </div>
        <div className="admin-order-details-items admin-scroll-list">
          {order.order_items?.map((item) => (
            <div key={item.id}>
              <div>
                <strong>{item.product?.name || t("Unknown product")}</strong>
                <small>{item.product?.item_code || t("No code")}</small>
              </div>
              <span>
                {item.quantity} × {formatVnd(item.unit_price)}
              </span>
              <b>
                {formatVnd(
                  item.quantity * item.unit_price - (item.discount_amount ?? 0),
                )}
              </b>
            </div>
          ))}
        </div>
        <div className="admin-order-details-total">
          <span>{t("Total")}</span>
          <strong>{formatVnd(order.total_amount)}</strong>
        </div>
      </div>
    </Modal>
  );
}
