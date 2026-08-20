import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Inbox,
  PackageCheck,
  ReceiptText,
  ShoppingBag,
  WalletCards,
} from "lucide-react";
import type { ReactNode } from "react";
import type { OfflineEventSummary, Order } from "../../../types/catalog";
import type { SalesSummaryState } from "../../../lib/sales";
import type { OrderFilter, OrderStatusCounts } from "../../../lib/api/orders";
import { listOfflineEvents } from "../../../lib/api/offlineEvents";
import { formatVnd } from "../../../utils/format";
import {
  confirmOrderPayment,
  cancelOrder,
  updateOrderFulfillment,
} from "../../../lib/api/orders";
import { useToast } from "../../ui/ToastProvider";
import { EmptyState } from "../../ui/EmptyState";
import { Button } from "../../ui/Button";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";
import { getUserFacingErrorMessage } from "../../../lib/errors";
import { SelectMenu } from "../../ui/SelectMenu";
import { ConfirmationDialog } from "../../ui/ConfirmationDialog";
import { OFFLINE_EVENT_UPDATED } from "../../../lib/offline/offlineEvents";
import { OrderCard } from "./OrderCard";
import { OrderDetailsModal } from "./OrderDetailsModal";
import { SalesSummaryPanel } from "./SalesSummaryPanel";
import { OrderDateFilterPicker } from "./OrderDateFilterPicker";
import { AdminCard } from "../shell/AdminCard";

type OrderQueueProps = {
  shopId: string;
  orders: Order[];
  filter: OrderViewFilter;
  selectedEventId: string;
  todayOnly: boolean | string;
  counts: OrderStatusCounts;
  eventCount: number;
  eventControl?: ReactNode;
  sales?: SalesSummaryState;
  page: number;
  pageSize: number;
  total: number;
  loading: boolean;
  onFilterChange: (filter: OrderViewFilter) => void;
  onSelectedEventChange: (eventId: string) => void;
  onTodayOnlyChange: (todayOnly: boolean | string) => void;
  onPageChange: (page: number) => void;
  onOrderUpdated: () => void;
};

export type OrderViewFilter = OrderFilter | "event";

function compactFilterCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

export function OrderQueue({
  shopId,
  orders,
  filter,
  selectedEventId,
  todayOnly,
  counts,
  eventCount,
  eventControl,
  sales,
  page,
  pageSize,
  total,
  loading,
  onFilterChange,
  onSelectedEventChange,
  onTodayOnlyChange,
  onPageChange,
  onOrderUpdated,
}: OrderQueueProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [fulfillmentBusyId, setFulfillmentBusyId] = useState<string | null>(
    null,
  );
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [eventOptions, setEventOptions] = useState<OfflineEventSummary[]>([]);
  const filterTabsRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const { locale, t } = usePlatformI18n();
  const dateLocale = locale === "vi" ? "vi-VN" : "en-US";

  useEffect(() => {
    const tabs = filterTabsRef.current;
    if (!tabs) return;
    const revealActiveFilter = () => {
      tabs
        .querySelector<HTMLButtonElement>("[aria-pressed='true']")
        ?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    };
    revealActiveFilter();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(revealActiveFilter);
    observer.observe(tabs);
    return () => observer.disconnect();
  }, [filter, locale]);
  const filters: OrderViewFilter[] = [
    "pending",
    "confirmed",
    "cancelled",
    "expired",
    "all",
    "event",
  ];
  const filterLabels: Record<OrderViewFilter, string> = {
    pending: t("Pending"),
    confirmed: t("Confirmed"),
    cancelled: t("Cancelled"),
    expired: t("Expired"),
    all: t("All"),
    event: t("Event"),
  };
  const statusFilterOptions = filters.map((item) => ({
    value: item,
    label: `${filterLabels[item]} · ${compactFilterCount(
      item === "event" ? eventCount : counts[item],
    )}`,
  }));
  const queueTitles: Record<OrderViewFilter, string> = {
    pending: t("Pending orders"),
    confirmed: t("Confirmed orders"),
    cancelled: t("Cancelled orders"),
    expired: t("Expired orders"),
    all: t("All orders"),
    event: t("Event orders"),
  };

  useEffect(() => {
    let active = true;
    const load = () =>
      listOfflineEvents(shopId)
        .then((events) => {
          if (active)
            setEventOptions(events.filter((event) => event.status !== "draft"));
        })
        .catch(() => undefined);
    void load();
    const handleEventUpdate = () => void load();
    window.addEventListener(OFFLINE_EVENT_UPDATED, handleEventUpdate);
    return () => {
      active = false;
      window.removeEventListener(OFFLINE_EVENT_UPDATED, handleEventUpdate);
    };
  }, [shopId]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstOrder = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastOrder = Math.min(page * pageSize, total);
  const totalMoney = orders.reduce((sum, order) => sum + order.total_amount, 0);
  const eventFilterOptions = useMemo(
    () => [
      { value: "", label: t("All events") },
      ...eventOptions.map((event) => ({
        value: event.id,
        label: `${event.name}${
          event.scheduledStartAt
            ? ` · ${new Date(event.scheduledStartAt).toLocaleDateString(dateLocale)}`
            : ""
        }`,
      })),
    ],
    [dateLocale, eventOptions, t],
  );
  const totalUnits = orders.reduce(
    (sum, order) =>
      sum +
      (order.order_items?.reduce(
        (itemSum, item) => itemSum + item.quantity,
        0,
      ) ?? 0),
    0,
  );
  const uniqueProductCount = new Set(
    orders.flatMap((order) =>
      (order.order_items ?? []).map((item) => item.product_id),
    ),
  ).size;
  const packingOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.status === "confirmed" &&
          (order.fulfillment_status ?? "preparing") !== "picked_up",
      ),
    [orders],
  );
  const packingUnits = packingOrders.reduce(
    (sum, order) =>
      sum +
      (order.order_items?.reduce(
        (itemSum, item) => itemSum + item.quantity,
        0,
      ) ?? 0),
    0,
  );
  const itemSummary = useMemo(() => {
    const summary = new Map<
      string,
      { name: string; code: string; quantity: number; imageUrl: string }
    >();
    packingOrders.forEach((order) =>
      order.order_items?.forEach((item) => {
        const name = item.product?.name || t("Unknown product");
        const code = item.product?.item_code || "";
        const key = `${name}__${code}`;
        const current = summary.get(key);
        summary.set(key, {
          name,
          code,
          quantity: (current?.quantity ?? 0) + item.quantity,
          imageUrl:
            current?.imageUrl || item.product?.images?.find(Boolean) || "",
        });
      }),
    );
    return [...summary.values()].sort(
      (first, second) => second.quantity - first.quantity,
    );
  }, [packingOrders, t]);

  async function handleConfirm(orderId: string) {
    setConfirmingId(orderId);
    try {
      const result = await confirmOrderPayment(orderId);
      onOrderUpdated();
      if (result.outcome !== "confirmed") {
        toast.info(
          t("This order was already handled by another staff member."),
        );
        return false;
      }
      toast.success(t("Payment confirmed."));
      return true;
    } catch (error) {
      toast.error(
        t(getUserFacingErrorMessage(error, "Failed to confirm payment.")),
        t("Could not confirm order"),
      );
      return false;
    } finally {
      setConfirmingId(null);
    }
  }

  async function handleCancel(orderId: string) {
    setCancellingId(orderId);
    try {
      const result = await cancelOrder(orderId);
      onOrderUpdated();
      if (result.outcome !== "cancelled")
        toast.info(
          t("This order was already handled by another staff member."),
        );
      else toast.success(t("Order cancelled and stock released."));
    } catch (error) {
      toast.error(
        t(getUserFacingErrorMessage(error, "Failed to cancel order.")),
        t("Could not cancel order"),
      );
    } finally {
      setCancellingId(null);
      setOrderToCancel(null);
    }
  }

  async function handleFulfillment(
    order: Order,
    status: "ready" | "picked_up",
  ) {
    if (order.source === "offline_event") {
      toast.info(t("Update Event Mode fulfilment on the designated device."));
      return;
    }
    setFulfillmentBusyId(order.id);
    try {
      const result = await updateOrderFulfillment(order.id, status);
      if (result.outcome === "updated" || result.outcome === "unchanged") {
        toast.success(
          t(
            status === "ready"
              ? "Order marked ready."
              : "Order marked picked up.",
          ),
        );
        setSelectedOrder((current) =>
          current?.id === order.id && result.order
            ? {
                ...current,
                ...result.order,
                order_items: current.order_items,
              }
            : current,
        );
        onOrderUpdated();
      } else {
        toast.info(t("This fulfilment update is no longer available."));
        onOrderUpdated();
      }
    } catch (error) {
      toast.error(
        t(getUserFacingErrorMessage(error, "Could not update fulfilment.")),
      );
    } finally {
      setFulfillmentBusyId(null);
    }
  }

  const isToday = todayOnly === true || todayOnly === "today";
  const isAllTime = todayOnly === false || todayOnly === "all";
  const customDate = !isToday && !isAllTime ? String(todayOnly) : "";

  const emptyTitle = loading
    ? t("Loading orders…")
    : isToday
      ? filter === "event"
        ? t("No event orders today")
        : filter === "all"
          ? t("No orders today")
          : t("No {{status}} orders today", { status: t(filter) })
      : customDate
        ? t("No orders on {{date}}", { date: customDate })
        : filter === "event"
          ? t("No event orders yet")
          : filter === "all"
            ? t("No orders yet")
            : t("No {{status}} orders", { status: t(filter) });

  return (
    <section className="admin-orders-view" aria-busy={loading}>
      <AdminCard
        title={queueTitles[filter]}
        description={t("Confirm payments and fulfil orders.")}
        icon={<ReceiptText size={18} />}
        className="admin-orders-workspace"
        density="compact"
        action={
          <small className="admin-order-range" aria-live="polite">
            {loading
              ? t("Refreshing…")
              : t("{{first}}–{{last}} of {{total}} · newest first", {
                  first: firstOrder,
                  last: lastOrder,
                  total,
                })}
          </small>
        }
      >
        <SalesSummaryPanel state={sales} />
        <div className="admin-filter-bar">
          <SelectMenu
            className="admin-status-filter"
            value={filter}
            label={t("Order status")}
            onChange={(value) => onFilterChange(value as OrderViewFilter)}
            options={statusFilterOptions}
          />
          <div
            className="admin-filter-tabs"
            ref={filterTabsRef}
            role="group"
            aria-label={t("Order status")}
          >
            {filters.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={filter === item}
                disabled={loading}
                className={`${filter === item ? "active" : ""} ${item === "event" ? "admin-event-filter" : ""}`}
                onClick={() => onFilterChange(item)}
              >
                {item === "event" && <CloudOff size={13} />}
                <span>{filterLabels[item]}</span>
                <b>
                  {compactFilterCount(
                    item === "event" ? eventCount : counts[item],
                  )}
                </b>
              </button>
            ))}
          </div>
          <div className="admin-queue-utilities">
            {filter === "event" && (
              <SelectMenu
                className="admin-event-select"
                value={selectedEventId}
                label={t("Event")}
                onChange={onSelectedEventChange}
                options={eventFilterOptions}
              />
            )}
            {eventControl}
            <OrderDateFilterPicker
              value={todayOnly}
              onChange={onTodayOnlyChange}
              disabled={loading}
            />
          </div>
        </div>

        {orders.length > 0 && (
          <div className="admin-order-metrics">
            <article>
              <span className="admin-metric-icon coral">
                <ReceiptText size={17} />
              </span>
              <div>
                <small>{t("Orders shown")}</small>
                <strong>{orders.length}</strong>
                <p>{t("{{count}} matching orders", { count: total })}</p>
              </div>
            </article>
            <article>
              <span className="admin-metric-icon teal">
                <WalletCards size={17} />
              </span>
              <div>
                <small>{t("Order value")}</small>
                <strong>{formatVnd(totalMoney)}</strong>
                <p>{t("Current page total")}</p>
              </div>
            </article>
            <article>
              <span className="admin-metric-icon mustard">
                <PackageCheck size={17} />
              </span>
              <div>
                <small>{t("Units requested")}</small>
                <strong>{totalUnits}</strong>
                <p>
                  {t("{{count}} unique products", {
                    count: uniqueProductCount,
                  })}
                </p>
              </div>
            </article>
          </div>
        )}

        {itemSummary.length > 0 && (
          <section className="admin-items-summary">
            <div className="admin-section-heading">
              <div>
                <span>{t("Fulfilment overview")}</span>
                <h2>{t("What needs to be packed")}</h2>
              </div>
              <small>
                {t("{{count}} total units", { count: packingUnits })}
              </small>
            </div>
            <div className="admin-items-summary-grid admin-scroll-list">
              {itemSummary.map((item) => (
                <article key={`${item.name}-${item.code}`}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" />
                  ) : (
                    <span className="admin-item-placeholder">
                      <ShoppingBag size={17} />
                    </span>
                  )}
                  <div>
                    <strong>{item.name}</strong>
                    <small>{item.code || t("No item code")}</small>
                  </div>
                  <b>{item.quantity}×</b>
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="admin-order-results">
          {orders.length === 0 ? (
            <EmptyState
              tone={loading ? "loading" : "neutral"}
              icon={loading ? undefined : <Inbox size={27} />}
              title={emptyTitle}
              message={
                loading
                  ? t("Fetching the latest queue from the server.")
                  : filter === "event"
                    ? t(
                        "Event orders appear here after they sync, or directly from this device while offline.",
                      )
                    : filter === "pending"
                      ? t("New orders appear here automatically.")
                      : t("There are no orders with this status yet.")
              }
              action={
                !loading && (filter !== "all" || !isAllTime) ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      onFilterChange("all");
                      onTodayOnlyChange(false);
                    }}
                  >
                    {t("View all orders")}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div
              className={`admin-orders-grid admin-scroll-list ${loading ? "is-loading" : ""}`}
            >
              {orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  isConfirming={loading || confirmingId === order.id}
                  isCancelling={loading || cancellingId === order.id}
                  isFulfillmentBusy={loading || fulfillmentBusyId === order.id}
                  onConfirm={() => handleConfirm(order.id)}
                  onCancel={() => setOrderToCancel(order)}
                  onDetails={() => setSelectedOrder(order)}
                  onFulfillment={(status) => handleFulfillment(order, status)}
                />
              ))}
            </div>
          )}
          {totalPages > 1 && (
            <nav
              className="admin-orders-pagination"
              aria-label={t("Order pages")}
            >
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => onPageChange(page - 1)}
              >
                <ChevronLeft size={16} /> {t("Previous")}
              </button>
              <span>
                {t("Page")} <b>{page}</b> {t("of")} {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => onPageChange(page + 1)}
              >
                {t("Next")} <ChevronRight size={16} />
              </button>
            </nav>
          )}
        </div>
      </AdminCard>
      <OrderDetailsModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
      <ConfirmationDialog
        isOpen={Boolean(orderToCancel)}
        title={t("Cancel order")}
        message={
          <>
            <strong>{orderToCancel?.order_code}</strong>
            {" — "}
            {t("Cancel this order? This cannot be undone.")}
          </>
        }
        cancelLabel={t("Keep order")}
        confirmLabel={t("Cancel and release stock")}
        loadingLabel={t("Cancelling…")}
        busy={Boolean(orderToCancel && cancellingId === orderToCancel.id)}
        onClose={() => setOrderToCancel(null)}
        onConfirm={() => {
          if (orderToCancel) void handleCancel(orderToCancel.id);
        }}
      />
    </section>
  );
}
