import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Ban, CheckCircle2, Clock3, Inbox, PackageCheck, ReceiptText, ShoppingBag, WalletCards } from "lucide-react";
import type { Order } from "../../types/catalog";
import { formatVnd } from "../../lib/format";
import { confirmOrderPayment, cancelOrder } from "../../lib/api";
import { SwipeConfirmButton } from "../catalog/PaymentQrModal";

type OrderQueueProps = { orders: Order[]; onOrderUpdated: () => void };
type Filter = "all" | "pending" | "confirmed" | "cancelled";

export function OrderQueue({ orders, onOrderUpdated }: OrderQueueProps) {
  const [filter, setFilter] = useState<Filter>("pending");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const filters: Filter[] = ["pending", "confirmed", "cancelled", "all"];
  const filteredOrders = useMemo(() => orders.filter((order) => filter === "all" || order.status === filter), [filter, orders]);
  const totalMoney = filteredOrders.reduce((sum, order) => sum + order.total_amount, 0);
  const totalUnits = filteredOrders.reduce((sum, order) => sum + (order.order_items?.reduce((itemSum, item) => itemSum + item.quantity, 0) ?? 0), 0);
  const itemSummary = useMemo(() => {
    const summary = new Map<string, { name: string; code: string; quantity: number; imageUrl: string }>();
    filteredOrders.forEach((order) => order.order_items?.forEach((item) => {
      const name = item.product?.name || "Unknown product";
      const code = item.product?.item_code || "";
      const key = `${name}__${code}`;
      const current = summary.get(key);
      summary.set(key, { name, code, quantity: (current?.quantity ?? 0) + item.quantity, imageUrl: current?.imageUrl || item.product?.images?.find(Boolean) || "" });
    }));
    return [...summary.values()].sort((first, second) => second.quantity - first.quantity);
  }, [filteredOrders]);

  async function handleConfirm(orderId: string) {
    setConfirmingId(orderId); setErrorMessage("");
    try { await confirmOrderPayment(orderId); onOrderUpdated(); }
    catch (error) { setErrorMessage(error instanceof Error ? error.message : "Failed to confirm payment."); }
    finally { setConfirmingId(null); }
  }

  async function handleCancel(orderId: string) {
    if (!window.confirm("Cancel this order? This cannot be undone.")) return;
    setCancellingId(orderId); setErrorMessage("");
    try { await cancelOrder(orderId); onOrderUpdated(); }
    catch (error) { setErrorMessage(error instanceof Error ? error.message : "Failed to cancel order."); }
    finally { setCancellingId(null); }
  }

  return (
    <section className="admin-orders-view">
      <div className="admin-filter-bar">
        <div className="admin-filter-tabs" role="tablist" aria-label="Order status">
          {filters.map((item) => <button key={item} type="button" className={filter === item ? "active" : ""} onClick={() => setFilter(item)}><span>{item}</span><b>{orders.filter((order) => item === "all" || order.status === item).length}</b></button>)}
        </div>
        <span className="admin-live-indicator"><i /> Live queue</span>
      </div>

      {errorMessage && <div className="admin-inline-error"><AlertTriangle size={17} /><span>{errorMessage}</span><button type="button" onClick={() => setErrorMessage("")}>Dismiss</button></div>}

      <div className="admin-order-metrics">
        <article><span className="admin-metric-icon coral"><ReceiptText size={19} /></span><div><small>Orders shown</small><strong>{filteredOrders.length}</strong><p>{filter === "all" ? "Across every status" : `${filter} orders`}</p></div></article>
        <article><span className="admin-metric-icon teal"><WalletCards size={19} /></span><div><small>Order value</small><strong>{formatVnd(totalMoney)}</strong><p>Current filtered total</p></div></article>
        <article><span className="admin-metric-icon mustard"><PackageCheck size={19} /></span><div><small>Units requested</small><strong>{totalUnits}</strong><p>{itemSummary.length} unique products</p></div></article>
      </div>

      {filteredOrders.length > 0 && <section className="admin-items-summary">
        <div className="admin-section-heading"><div><span>Fulfilment overview</span><h2>What needs to be packed</h2></div><small>{totalUnits} total units</small></div>
        <div className="admin-items-summary-grid">
          {itemSummary.map((item) => <article key={`${item.name}-${item.code}`}>{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span className="admin-item-placeholder"><ShoppingBag size={17} /></span>}<div><strong>{item.name}</strong><small>{item.code || "No item code"}</small></div><b>{item.quantity}×</b></article>)}
        </div>
      </section>}

      <div className="admin-section-heading"><div><span>Order queue</span><h2>{filter === "all" ? "All orders" : `${filter[0].toUpperCase()}${filter.slice(1)} orders`}</h2></div><small>Newest first</small></div>
      {filteredOrders.length === 0 ? <div className="admin-orders-empty"><Inbox size={44} /><h3>No {filter === "all" ? "" : filter} orders</h3><p>New orders will appear here automatically.</p></div> : <div className="admin-orders-grid">{filteredOrders.map((order) => <OrderCard key={order.id} order={order} isConfirming={confirmingId === order.id} isCancelling={cancellingId === order.id} onConfirm={() => handleConfirm(order.id)} onCancel={() => handleCancel(order.id)} />)}</div>}
    </section>
  );
}

type OrderCardProps = { order: Order; isConfirming: boolean; isCancelling: boolean; onConfirm: () => void; onCancel: () => void };

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
