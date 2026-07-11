import { useEffect, useMemo, useState } from "react";
import { Ban, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Inbox, PackageCheck, ReceiptText, ShoppingBag, WalletCards } from "lucide-react";
import type { Order } from "../../types/catalog";
import type { OrderFilter, OrderStatusCounts } from "../../lib/api";
import { formatVnd } from "../../lib/format";
import { confirmOrderPayment, cancelOrder } from "../../lib/api";
import { SwipeConfirmButton } from "../catalog/PaymentQrModal";
import { useToast } from "../ui/ToastProvider";
import { EmptyState } from "../ui/EmptyState";
import { Button } from "../ui/Button";

type OrderQueueProps = {
  orders: Order[];
  filter: OrderFilter;
  counts: OrderStatusCounts;
  page: number;
  pageSize: number;
  total: number;
  loading: boolean;
  onFilterChange: (filter: OrderFilter) => void;
  onPageChange: (page: number) => void;
  onOrderUpdated: () => void;
};

export function OrderQueue({ orders, filter, counts, page, pageSize, total, loading, onFilterChange, onPageChange, onOrderUpdated }: OrderQueueProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const toast = useToast();
  const filters: OrderFilter[] = ["pending", "confirmed", "cancelled", "all"];
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstOrder = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastOrder = Math.min(page * pageSize, total);
  const totalMoney = orders.reduce((sum, order) => sum + order.total_amount, 0);
  const totalUnits = orders.reduce((sum, order) => sum + (order.order_items?.reduce((itemSum, item) => itemSum + item.quantity, 0) ?? 0), 0);
  const itemSummary = useMemo(() => {
    const summary = new Map<string, { name: string; code: string; quantity: number; imageUrl: string }>();
    orders.forEach((order) => order.order_items?.forEach((item) => {
      const name = item.product?.name || "Unknown product";
      const code = item.product?.item_code || "";
      const key = `${name}__${code}`;
      const current = summary.get(key);
      summary.set(key, { name, code, quantity: (current?.quantity ?? 0) + item.quantity, imageUrl: current?.imageUrl || item.product?.images?.find(Boolean) || "" });
    }));
    return [...summary.values()].sort((first, second) => second.quantity - first.quantity);
  }, [orders]);

  async function handleConfirm(orderId: string) {
    setConfirmingId(orderId);
    try { await confirmOrderPayment(orderId); onOrderUpdated(); toast.success("Payment confirmed and stock updated."); return true; }
    catch (error) { toast.error(error instanceof Error ? error.message : "Failed to confirm payment.", "Could not confirm order"); return false; }
    finally { setConfirmingId(null); }
  }

  async function handleCancel(orderId: string) {
    if (!window.confirm("Cancel this order? This cannot be undone.")) return;
    setCancellingId(orderId);
    try { await cancelOrder(orderId); onOrderUpdated(); toast.success("Order cancelled."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Failed to cancel order.", "Could not cancel order"); }
    finally { setCancellingId(null); }
  }

  return (
    <section className="admin-orders-view">
      <div className="admin-filter-bar">
        <div className="admin-filter-tabs" role="tablist" aria-label="Order status">
          {filters.map((item) => <button key={item} type="button" className={filter === item ? "active" : ""} onClick={() => onFilterChange(item)}><span>{item}</span><b>{counts[item]}</b></button>)}
        </div>
        <span className="admin-live-indicator"><i /> Live queue</span>
      </div>

      <div className="admin-order-metrics">
        <article><span className="admin-metric-icon coral"><ReceiptText size={19} /></span><div><small>Orders shown</small><strong>{orders.length}</strong><p>{total} matching orders</p></div></article>
        <article><span className="admin-metric-icon teal"><WalletCards size={19} /></span><div><small>Order value</small><strong>{formatVnd(totalMoney)}</strong><p>Current page total</p></div></article>
        <article><span className="admin-metric-icon mustard"><PackageCheck size={19} /></span><div><small>Units requested</small><strong>{totalUnits}</strong><p>{itemSummary.length} unique products</p></div></article>
      </div>

      {orders.length > 0 && <section className="admin-items-summary">
        <div className="admin-section-heading"><div><span>Fulfilment overview</span><h2>What needs to be packed</h2></div><small>{totalUnits} total units</small></div>
        <div className="admin-items-summary-grid">
          {itemSummary.map((item) => <article key={`${item.name}-${item.code}`}>{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span className="admin-item-placeholder"><ShoppingBag size={17} /></span>}<div><strong>{item.name}</strong><small>{item.code || "No item code"}</small></div><b>{item.quantity}×</b></article>)}
        </div>
      </section>}

      <div className="admin-section-heading"><div><span>Order queue</span><h2>{filter === "all" ? "All orders" : `${filter[0].toUpperCase()}${filter.slice(1)} orders`}</h2></div><small>{loading ? "Refreshing…" : `${firstOrder}–${lastOrder} of ${total} · newest first`}</small></div>
      {orders.length === 0 ? (
        <EmptyState
          icon={<Inbox size={27} />}
          title={loading ? "Loading orders…" : filter === "all" ? "No orders yet" : `No ${filter} orders`}
          message={loading ? "Fetching the latest queue from the server." : filter === "pending" ? "You’re all caught up. New orders will appear here automatically." : "There are no orders with this status yet."}
          meta={loading ? [] : [filter === "all" ? "All statuses" : `${filter[0].toUpperCase()}${filter.slice(1)}`, "Live updates on"]}
          action={!loading && filter !== "all" ? <Button type="button" variant="secondary" onClick={() => onFilterChange("all")}>View all orders</Button> : undefined}
        />
      ) : <div className={`admin-orders-grid ${loading ? "is-loading" : ""}`}>{orders.map((order) => <OrderCard key={order.id} order={order} isConfirming={confirmingId === order.id} isCancelling={cancellingId === order.id} onConfirm={() => handleConfirm(order.id)} onCancel={() => handleCancel(order.id)} />)}</div>}
      {totalPages > 1 && <nav className="admin-orders-pagination" aria-label="Order pages"><button type="button" disabled={page <= 1 || loading} onClick={() => onPageChange(page - 1)}><ChevronLeft size={16} /> Previous</button><span>Page <b>{page}</b> of {totalPages}</span><button type="button" disabled={page >= totalPages || loading} onClick={() => onPageChange(page + 1)}>Next <ChevronRight size={16} /></button></nav>}
    </section>
  );
}

type OrderCardProps = { order: Order; isConfirming: boolean; isCancelling: boolean; onConfirm: () => Promise<boolean>; onCancel: () => void };

function OrderCard({ order, isConfirming, isCancelling, onConfirm, onCancel }: OrderCardProps) {
  const [elapsedTime, setElapsedTime] = useState("");
  useEffect(() => {
    function updateTime() { const seconds = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 1000); const minutes = Math.floor(seconds / 60); setElapsedTime(seconds < 60 ? "Just now" : minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`); }
    updateTime(); const interval = window.setInterval(updateTime, 15000); return () => window.clearInterval(interval);
  }, [order.created_at]);

  const statusIcon = order.status === "confirmed" ? <CheckCircle2 size={14} /> : order.status === "cancelled" ? <Ban size={14} /> : <Clock3 size={14} />;
  return (
    <article className={`admin-order-card status-${order.status}`}>
      <header><div><span className="admin-order-code">{order.order_code}</span><span className="admin-order-time"><Clock3 size={13} /> {elapsedTime}</span></div><span className={`admin-order-status ${order.status}`}>{statusIcon}{order.status}</span></header>
      {order.customer_name && <div className="admin-order-customer"><span>Pickup name</span><strong>{order.customer_name}</strong></div>}
      <div className="admin-order-items">
        {order.order_items?.map((item) => { const image = item.product?.images?.find(Boolean); return <div key={item.id} className="admin-order-item">{image ? <img src={image} alt="" /> : <span className="admin-order-item-placeholder"><ShoppingBag size={15} /></span>}<div><strong>{item.product?.name || "Unknown product"}</strong><small>{item.product?.item_code || "No code"}</small></div><b>{item.quantity}×</b></div>; })}
      </div>
      <footer><span>Total</span><strong>{formatVnd(order.total_amount)}</strong></footer>
      {order.status === "pending" && <div className="admin-order-actions"><SwipeConfirmButton onConfirm={onConfirm} isConfirming={isConfirming} /><button type="button" className="admin-cancel-order" onClick={onCancel} disabled={isConfirming || isCancelling}><Ban size={15} />{isCancelling ? "Cancelling…" : "Cancel order"}</button></div>}
    </article>
  );
}
