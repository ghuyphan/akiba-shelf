import { useEffect, useRef, useState } from "react";
import { Clock, Ban, CheckCircle, AlertTriangle, Inbox } from "lucide-react";
import type { Order } from "../../types/catalog";
import { formatVnd } from "../../lib/format";
import { confirmOrderPayment, cancelOrder } from "../../lib/api";
import { SwipeConfirmButton } from "../catalog/PaymentQrModal";

type OrderQueueProps = {
  orders: Order[];
  onOrderUpdated: () => void;
};

export function OrderQueue({ orders, onOrderUpdated }: OrderQueueProps) {
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed" | "cancelled">("pending");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const rowRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const categories = ["pending", "confirmed", "cancelled", "all"] as const;

  useEffect(() => {
    const row = rowRef.current;
    const activeIndex = categories.indexOf(filter);
    const activeChip = chipRefs.current[activeIndex];
    if (!row || !activeChip) return;
    const currentRow = row;
    const currentActiveChip = activeChip;

    function updateIndicator() {
      requestAnimationFrame(() => {
        const rowRect = currentRow.getBoundingClientRect();
        const chipRect = currentActiveChip.getBoundingClientRect();
        if (rowRect.width === 0 || chipRect.width === 0) return;
        currentRow.style.setProperty("--active-left", `${chipRect.left - rowRect.left + currentRow.scrollLeft}px`);
        currentRow.style.setProperty("--active-width", `${chipRect.width}px`);
      });
    }

    updateIndicator();
    const observer = new ResizeObserver(updateIndicator);
    observer.observe(currentRow);
    observer.observe(currentActiveChip);
    window.addEventListener("resize", updateIndicator);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [filter]);

  const filteredOrders = orders.filter((order) => {
    if (filter === "all") return true;
    return order.status === filter;
  });

  const handleConfirm = async (orderId: string) => {
    setConfirmingId(orderId);
    setErrorMessage("");
    try {
      await confirmOrderPayment(orderId);
      onOrderUpdated();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to confirm payment.");
    } finally {
      setConfirmingId(null);
    }
  };

  const handleCancel = async (orderId: string) => {
    if (!window.confirm("Are you sure you want to cancel this order? This cannot be undone.")) return;
    setCancellingId(orderId);
    setErrorMessage("");
    try {
      await cancelOrder(orderId);
      onOrderUpdated();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to cancel order.");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="order-queue-container" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header & Filter Controls */}
      <div 
        className="queue-controls" 
        style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          flexWrap: "wrap",
          gap: "12px"
        }}
      >
        <div className="category-row" ref={rowRef}>
          {categories.map((tab) => {
            const count = orders.filter((o) => tab === "all" ? true : o.status === tab).length;
            const isActive = filter === tab;
            const index = categories.indexOf(tab);
            return (
              <button
                key={tab}
                ref={(el) => {
                  chipRefs.current[index] = el;
                }}
                type="button"
                className={`chip ${isActive ? "chip-active" : ""}`}
                onClick={() => setFilter(tab)}
                style={{ textTransform: "capitalize", whiteSpace: "nowrap" }}
              >
                {tab} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {errorMessage && (
        <div 
          style={{ 
            padding: "12px 16px", 
            background: "rgba(239, 68, 68, 0.08)", 
            color: "var(--red, #ef4444)", 
            borderRadius: "8px", 
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <AlertTriangle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Grid List */}
      {filteredOrders.length === 0 ? (
        <div 
          style={{ 
            display: "flex", 
            flexDirection: "column", 
            alignItems: "center", 
            justifyContent: "center", 
            padding: "60px 20px", 
            background: "var(--surface-soft)", 
            borderRadius: "16px",
            border: "1px dashed var(--line)",
            color: "var(--muted)",
            textAlign: "center",
            gap: "12px"
          }}
        >
          <Inbox size={48} style={{ strokeWidth: 1.2, color: "var(--muted)" }} />
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--ink)", margin: "0 0 4px 0" }}>No orders found</h3>
            <p style={{ fontSize: "13px", margin: 0 }}>There are no {filter} orders at the moment.</p>
          </div>
        </div>
      ) : (
        <div 
          className="orders-grid" 
          style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", 
            gap: "16px" 
          }}
        >
          {filteredOrders.map((order) => (
            <OrderCard 
              key={order.id} 
              order={order} 
              isConfirming={confirmingId === order.id}
              isCancelling={cancellingId === order.id}
              onConfirm={() => handleConfirm(order.id)}
              onCancel={() => handleCancel(order.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type OrderCardProps = {
  order: Order;
  isConfirming: boolean;
  isCancelling: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

function OrderCard({ order, isConfirming, isCancelling, onConfirm, onCancel }: OrderCardProps) {
  const [elapsedTime, setElapsedTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const diff = Date.now() - new Date(order.created_at).getTime();
      const seconds = Math.floor(diff / 1000);
      if (seconds < 60) {
        setElapsedTime("Just now");
      } else {
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) {
          setElapsedTime(`${minutes}m ago`);
        } else {
          const hours = Math.floor(minutes / 60);
          setElapsedTime(`${hours}h ago`);
        }
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [order.created_at]);

  const statusColors = {
    pending: { bg: "color-mix(in srgb, var(--coral) 8%, transparent)", text: "var(--coral, #ff6fae)" },
    confirmed: { bg: "color-mix(in srgb, var(--teal) 8%, transparent)", text: "var(--teal, #6fc7ff)" },
    cancelled: { bg: "color-mix(in srgb, var(--muted) 8%, transparent)", text: "var(--muted, #64748b)" },
  };

  const currentColors = statusColors[order.status] || statusColors.pending;

  return (
    <div 
      className="order-card" 
      style={{ 
        background: "var(--card-bg, #ffffff)", 
        border: "1px solid var(--line, #e2e8f0)", 
        borderRadius: "16px", 
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))",
        position: "relative",
        animation: "card-enter 300ms var(--ease-out)"
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h4 style={{ fontSize: "18px", fontWeight: "900", color: "var(--ink)", margin: "0 0 2px 0", letterSpacing: "0.5px" }}>
            {order.order_code}
          </h4>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--muted)" }}>
            <Clock size={12} />
            <span>{elapsedTime}</span>
          </div>
        </div>
        
        <span 
          style={{ 
            fontSize: "11px", 
            fontWeight: "700", 
            textTransform: "uppercase", 
            padding: "4px 8px", 
            borderRadius: "12px",
            background: currentColors.bg,
            color: currentColors.text
          }}
        >
          {order.status}
        </span>
      </div>

      {/* Customer Name */}
      {order.customer_name && (
        <div style={{ background: "var(--surface-soft)", padding: "6px 12px", borderRadius: "8px", fontSize: "13px" }}>
          <span style={{ color: "var(--muted)", marginRight: "6px" }}>Customer:</span>
          <strong style={{ color: "var(--ink)" }}>{order.customer_name}</strong>
        </div>
      )}

      {/* Items List */}
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--muted)", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
          Items
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {order.order_items?.map((item) => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span 
                  style={{ 
                    background: "var(--surface-soft)", 
                    borderRadius: "4px", 
                    width: "20px", 
                    height: "20px", 
                    display: "grid", 
                    placeItems: "center", 
                    fontSize: "11px", 
                    fontWeight: "700",
                    border: "1px solid var(--line)"
                  }}
                >
                  {item.quantity}
                </span>
                <span style={{ color: "var(--ink)", fontWeight: "500" }}>{item.product?.name || "Unknown Product"}</span>
              </div>
              <span style={{ color: "var(--muted)", fontSize: "12px" }}>
                {item.product?.item_code && `[${item.product.item_code}]`}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop: "1px dashed var(--line)", margin: "4px 0" }} />

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "12px", color: "var(--muted)" }}>Total Value</span>
        <strong style={{ fontSize: "16px", fontWeight: "800", color: "var(--ink)" }}>
          {formatVnd(order.total_amount)}
        </strong>
      </div>

      {/* Action Buttons (Only for pending) */}
      {order.status === "pending" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "4px" }}>
          <SwipeConfirmButton onConfirm={onConfirm} isConfirming={isConfirming} />
          
          <button
            type="button"
            className="button button-ghost"
            style={{ 
              width: "100%", 
              color: "var(--red, #ef4444)", 
              fontSize: "12px",
              minHeight: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px"
            }}
            onClick={onCancel}
            disabled={isConfirming || isCancelling}
          >
            <Ban size={12} />
            <span>Cancel Order</span>
          </button>
        </div>
      )}
    </div>
  );
}
