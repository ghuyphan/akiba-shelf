import { useEffect, useMemo, useState } from "react";
import { Ban, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Inbox, LoaderCircle, PackageCheck, ReceiptText, ShoppingBag, WalletCards } from "lucide-react";
import type { Order } from "../../types/catalog";
import type { OrderFilter, OrderStatusCounts } from "../../lib/api";
import { formatRelativeTime, formatVnd } from "../../utils/format";
import { confirmOrderPayment, cancelOrder } from "../../lib/api";
import { SwipeConfirmButton } from "./SwipeConfirmButton";
import { useToast } from "../ui/ToastProvider";
import { EmptyState } from "../ui/EmptyState";
import { Button } from "../ui/Button";
import { usePlatformI18n } from "../../lib/i18n/platformI18n";

type OrderQueueProps = {
  orders: Order[];
  filter: OrderFilter;
  todayOnly: boolean;
  counts: OrderStatusCounts;
  page: number;
  pageSize: number;
  total: number;
  loading: boolean;
  onFilterChange: (filter: OrderFilter) => void;
  onTodayOnlyChange: (todayOnly: boolean) => void;
  onPageChange: (page: number) => void;
  onOrderUpdated: () => void;
};

export function OrderQueue({ orders, filter, todayOnly, counts, page, pageSize, total, loading, onFilterChange, onTodayOnlyChange, onPageChange, onOrderUpdated }: OrderQueueProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const toast = useToast();
  const { t } = usePlatformI18n();
  const filters: OrderFilter[] = ["pending", "confirmed", "cancelled", "expired", "all"];
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstOrder = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastOrder = Math.min(page * pageSize, total);
  const totalMoney = orders.reduce((sum, order) => sum + order.total_amount, 0);
  const totalUnits = orders.reduce((sum, order) => sum + (order.order_items?.reduce((itemSum, item) => itemSum + item.quantity, 0) ?? 0), 0);
  const itemSummary = useMemo(() => {
    const summary = new Map<string, { name: string; code: string; quantity: number; imageUrl: string }>();
    orders.forEach((order) => order.order_items?.forEach((item) => {
      const name = item.product?.name || t("Unknown product");
      const code = item.product?.item_code || "";
      const key = `${name}__${code}`;
      const current = summary.get(key);
      summary.set(key, { name, code, quantity: (current?.quantity ?? 0) + item.quantity, imageUrl: current?.imageUrl || item.product?.images?.find(Boolean) || "" });
    }));
    return [...summary.values()].sort((first, second) => second.quantity - first.quantity);
  }, [orders, t]);

  async function handleConfirm(orderId: string) {
    setConfirmingId(orderId);
    try { const result = await confirmOrderPayment(orderId); onOrderUpdated(); if (result.outcome !== "confirmed") { toast.info(t("This order was already handled by another staff member.")); return false; } toast.success(t("Payment confirmed.")); return true; }
    catch (error) { toast.error(t(error instanceof Error ? error.message : "Failed to confirm payment."), t("Could not confirm order")); return false; }
    finally { setConfirmingId(null); }
  }

  async function handleCancel(orderId: string) {
    if (!window.confirm(t("Cancel this order? This cannot be undone."))) return;
    setCancellingId(orderId);
    try { const result = await cancelOrder(orderId); onOrderUpdated(); if (result.outcome !== "cancelled") toast.info(t("This order was already handled by another staff member.")); else toast.success(t("Order cancelled and stock released.")); }
    catch (error) { toast.error(t(error instanceof Error ? error.message : "Failed to cancel order."), t("Could not cancel order")); }
    finally { setCancellingId(null); }
  }

  const emptyTitle = loading
    ? t("Loading orders…")
    : todayOnly
      ? filter === "all"
        ? t("No orders today")
        : t("No {{status}} orders today", { status: t(filter) })
      : filter === "all"
        ? t("No orders yet")
        : t("No {{status}} orders", { status: t(filter) });

  return (
    <section className="admin-orders-view">
      <div className="admin-filter-bar">
        <div className="admin-filter-tabs" role="tablist" aria-label={t("Order status")}>
          {filters.map((item) => <button key={item} type="button" className={filter === item ? "active" : ""} onClick={() => onFilterChange(item)}><span>{t(item)}</span><b>{counts[item]}</b></button>)}
        </div>
        <div className="admin-queue-utilities">
          <button type="button" className={`admin-today-toggle ${todayOnly ? "active" : ""}`} aria-pressed={todayOnly} onClick={() => onTodayOnlyChange(!todayOnly)}>
            <CalendarDays size={14} /><span>{t("Today")}</span>
          </button>
          <span className="admin-live-indicator"><i /> {t("Live queue")}</span>
        </div>
      </div>

      <div className="admin-order-metrics">
        <article><span className="admin-metric-icon coral"><ReceiptText size={19} /></span><div><small>{t("Orders shown")}</small><strong>{orders.length}</strong><p>{t("{{count}} matching orders", { count: total })}</p></div></article>
        <article><span className="admin-metric-icon teal"><WalletCards size={19} /></span><div><small>{t("Order value")}</small><strong>{formatVnd(totalMoney)}</strong><p>{t("Current page total")}</p></div></article>
        <article><span className="admin-metric-icon mustard"><PackageCheck size={19} /></span><div><small>{t("Units requested")}</small><strong>{totalUnits}</strong><p>{t("{{count}} unique products", { count: itemSummary.length })}</p></div></article>
      </div>

      {orders.length > 0 && <section className="admin-items-summary">
        <div className="admin-section-heading"><div><span>{t("Fulfilment overview")}</span><h2>{t("What needs to be packed")}</h2></div><small>{t("{{count}} total units", { count: totalUnits })}</small></div>
        <div className="admin-items-summary-grid">
          {itemSummary.map((item) => <article key={`${item.name}-${item.code}`}>{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span className="admin-item-placeholder"><ShoppingBag size={17} /></span>}<div><strong>{item.name}</strong><small>{item.code || t("No item code")}</small></div><b>{item.quantity}×</b></article>)}
        </div>
      </section>}

      <div className="admin-section-heading"><div><span>{t("Order queue")}</span><h2>{filter === "all" ? t("All orders") : t("{{status}} orders", { status: t(filter) })}</h2></div><small>{loading ? t("Refreshing…") : t("{{first}}–{{last}} of {{total}} · newest first", { first: firstOrder, last: lastOrder, total })}</small></div>
      {orders.length === 0 ? (
        <EmptyState
          tone={loading ? "loading" : "neutral"}
          icon={loading ? <LoaderCircle className="state-spinner" size={27} /> : <Inbox size={27} />}
          title={emptyTitle}
          message={loading ? t("Fetching the latest queue from the server.") : filter === "pending" ? t("You’re all caught up. New orders will appear here automatically.") : t("There are no orders with this status yet.")}
          meta={loading ? [] : [...(todayOnly ? [t("Today")] : []), filter === "all" ? t("All statuses") : t(filter), t("Live updates on")]}
          action={!loading && (filter !== "all" || todayOnly) ? <Button type="button" variant="secondary" onClick={() => { onFilterChange("all"); onTodayOnlyChange(false); }}>{t("View all orders")}</Button> : undefined}
        />
      ) : <div className={`admin-orders-grid ${loading ? "is-loading" : ""}`}>{orders.map((order) => <OrderCard key={order.id} order={order} isConfirming={confirmingId === order.id} isCancelling={cancellingId === order.id} onConfirm={() => handleConfirm(order.id)} onCancel={() => handleCancel(order.id)} />)}</div>}
      {totalPages > 1 && <nav className="admin-orders-pagination" aria-label={t("Order pages")}><button type="button" disabled={page <= 1 || loading} onClick={() => onPageChange(page - 1)}><ChevronLeft size={16} /> {t("Previous")}</button><span>{t("Page")} <b>{page}</b> {t("of")} {totalPages}</span><button type="button" disabled={page >= totalPages || loading} onClick={() => onPageChange(page + 1)}>{t("Next")} <ChevronRight size={16} /></button></nav>}
    </section>
  );
}

type OrderCardProps = { order: Order; isConfirming: boolean; isCancelling: boolean; onConfirm: () => Promise<boolean>; onCancel: () => void };

function formatAdminRelativeTime(value: string | Date, locale: "en" | "vi") {
  if (locale === "en") return formatRelativeTime(value);
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Vừa xong";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

function OrderCard({ order, isConfirming, isCancelling, onConfirm, onCancel }: OrderCardProps) {
  const [elapsedTime, setElapsedTime] = useState("");
  const { locale, t } = usePlatformI18n();
  useEffect(() => {
    function updateTime() { setElapsedTime(formatAdminRelativeTime(order.created_at, locale)); }
    updateTime(); const interval = window.setInterval(updateTime, 15000); return () => window.clearInterval(interval);
  }, [locale, order.created_at]);

  const statusIcon = order.status === "confirmed" ? <CheckCircle2 size={14} /> : order.status === "cancelled" || order.status === "expired" ? <Ban size={14} /> : <Clock3 size={14} />;
  return (
    <article className={`admin-order-card status-${order.status}`}>
      <header><div><span className="admin-order-code">{order.order_code}</span><span className="admin-order-time"><Clock3 size={13} /> {elapsedTime}</span></div><span className={`admin-order-status ${order.status}`}>{statusIcon}{t(order.status)}</span></header>
      {order.customer_name && <div className="admin-order-customer"><span>{t("Pickup name")}</span><strong>{order.customer_name}</strong></div>}
      <div className="admin-order-items">
        {order.order_items?.map((item) => { const image = item.product?.images?.find(Boolean); return <div key={item.id} className="admin-order-item">{image ? <img src={image} alt="" /> : <span className="admin-order-item-placeholder"><ShoppingBag size={15} /></span>}<div><strong>{item.product?.name || t("Unknown product")}</strong><small>{item.product?.item_code || t("No code")}</small></div><b>{item.quantity}×</b></div>; })}
      </div>
      <footer>{Boolean(order.discount_amount) && <span className="admin-order-discount">{t("Promotion savings")} · −{formatVnd(order.discount_amount ?? 0)}</span>}<span>{t("Total")}</span><strong>{formatVnd(order.total_amount)}</strong></footer>
      {order.status === "pending" && <div className="admin-order-actions"><SwipeConfirmButton onConfirm={onConfirm} isConfirming={isConfirming} /><button type="button" className="admin-cancel-order" onClick={onCancel} disabled={isConfirming || isCancelling}><Ban size={15} />{isCancelling ? t("Cancelling…") : t("Cancel and release stock")}</button></div>}
    </article>
  );
}
