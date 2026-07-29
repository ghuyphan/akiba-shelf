import type {
  Order,
  SalesSummary,
  SalesProductSummary,
} from "../types/catalog";

export type SalesSummaryState = {
  summary: SalesSummary | null;
  status: "authoritative" | "provisional" | "fallback";
};

export function projectSalesSummary(
  orders: Order[],
  from: string,
  to: string,
): SalesSummary {
  const fromTime = Date.parse(from);
  const toTime = Date.parse(to);
  const products = new Map<string, SalesProductSummary>();
  let confirmedOrderCount = 0;
  let discountAmount = 0;
  let unitsSold = 0;
  let onlineRevenue = 0;
  let eventRevenue = 0;
  let cashRevenue = 0;
  let vietqrRevenue = 0;
  let revenue = 0;
  for (const order of orders) {
    if (order.status !== "confirmed") continue;
    const timestamp = Date.parse(order.confirmed_at ?? order.created_at);
    if (timestamp < fromTime || timestamp >= toTime) continue;
    confirmedOrderCount += 1;
    revenue += order.total_amount;
    discountAmount += order.discount_amount ?? 0;
    if (order.source === "offline_event") {
      eventRevenue += order.total_amount;
      if (order.payment_method === "cash") cashRevenue += order.total_amount;
      if (order.payment_method === "vietqr")
        vietqrRevenue += order.total_amount;
    } else {
      onlineRevenue += order.total_amount;
    }
    for (const item of order.order_items ?? []) {
      const revenue =
        item.unit_price * item.quantity - (item.discount_amount ?? 0);
      const current = products.get(item.product_id) ?? {
        product_id: item.product_id,
        name: item.product?.name ?? item.product_id,
        item_code: item.product?.item_code ?? "",
        units: 0,
        revenue: 0,
        discount_amount: 0,
      };
      current.units += item.quantity;
      current.revenue += revenue;
      current.discount_amount += item.discount_amount ?? 0;
      products.set(item.product_id, current);
      unitsSold += item.quantity;
    }
  }
  return {
    from,
    to,
    revenue,
    discount_amount: discountAmount,
    confirmed_order_count: confirmedOrderCount,
    units_sold: unitsSold,
    online_revenue: onlineRevenue,
    event_revenue: eventRevenue,
    cash_revenue: cashRevenue,
    vietqr_revenue: vietqrRevenue,
    product_breakdown: [...products.values()].sort(
      (a, b) => b.revenue - a.revenue,
    ),
  };
}

export function mergeSalesSummaries(
  authoritative: SalesSummary,
  provisional: SalesSummary,
): SalesSummary {
  const products = new Map(
    authoritative.product_breakdown.map((product) => [
      product.product_id,
      { ...product },
    ]),
  );
  for (const product of provisional.product_breakdown) {
    const current = products.get(product.product_id);
    products.set(
      product.product_id,
      current
        ? {
            ...current,
            units: current.units + product.units,
            revenue: current.revenue + product.revenue,
            discount_amount: current.discount_amount + product.discount_amount,
          }
        : { ...product },
    );
  }
  return {
    ...authoritative,
    revenue: authoritative.revenue + provisional.revenue,
    discount_amount:
      authoritative.discount_amount + provisional.discount_amount,
    confirmed_order_count:
      authoritative.confirmed_order_count + provisional.confirmed_order_count,
    units_sold: authoritative.units_sold + provisional.units_sold,
    online_revenue: authoritative.online_revenue + provisional.online_revenue,
    event_revenue: authoritative.event_revenue + provisional.event_revenue,
    cash_revenue: authoritative.cash_revenue + provisional.cash_revenue,
    vietqr_revenue: authoritative.vietqr_revenue + provisional.vietqr_revenue,
    product_breakdown: [...products.values()].sort(
      (a, b) => b.revenue - a.revenue,
    ),
  };
}
