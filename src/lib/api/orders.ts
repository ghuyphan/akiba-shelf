import {
  FunctionsFetchError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import { safePublicUrl } from "../branding";
import {
  orderItemProductSchema,
  orderMutationSchema,
  orderSchema,
  orderStatusCountsSchema,
} from "../schemas";
import type {
  CartItem,
  Order,
  OrderItemProduct,
  OrderMutationResult,
  OrderStatus,
} from "../../types/catalog";
import { extractEdgeFunctionError, requireSupabase } from "./shared";

export class CheckoutOutcomeUnknownError extends Error {
  constructor(message = "The checkout result could not be verified. Retry safely with the same checkout details.") {
    super(message);
    this.name = "CheckoutOutcomeUnknownError";
  }
}

export function isCheckoutOutcomeUnknownError(
  error: unknown,
): error is CheckoutOutcomeUnknownError {
  return error instanceof CheckoutOutcomeUnknownError;
}

export async function createOrder(
  shopSlug: string,
  customerName: string | null,
  cart: CartItem[],
  clientRequestId: string,
  recoveryToken: string,
): Promise<Order> {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke("create-order", {
    body: {
      shopSlug,
      customerName: customerName?.trim() || null,
      items: cart.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity + (item.reward_quantity ?? 0),
        reward_quantity: item.reward_quantity ?? 0,
      })),
      clientRequestId,
      recoveryToken,
    },
  });
  if (error) {
    if (
      error instanceof FunctionsFetchError ||
      error instanceof FunctionsRelayError
    ) {
      throw new CheckoutOutcomeUnknownError();
    }
    const message = await extractEdgeFunctionError(error);
    const status = "context" in error ? error.context?.status : undefined;
    if (typeof status === "number" && status >= 500) {
      throw new CheckoutOutcomeUnknownError(message ?? undefined);
    }
    if (message) throw new Error(message);
    throw error;
  }

  const parsed = orderSchema.safeParse(data);
  if (!parsed.success) throw new CheckoutOutcomeUnknownError();
  const createdOrder = parsed.data as Order;
  void client.functions
    .invoke("notify-new-order", {
      body: { orderId: createdOrder.id, recoveryToken },
    })
    .catch(() => undefined);
  return createdOrder;
}

export async function getCustomerOrder(
  orderId: string,
  recoveryToken: string,
): Promise<Order | null> {
  const { data, error } = await requireSupabase().rpc("get_customer_order", {
    p_order_id: orderId,
    p_recovery_token: recoveryToken,
  });
  if (error) throw error;
  const order = Array.isArray(data) ? data[0] : data;
  return order ? (orderSchema.parse(order) as Order) : null;
}

export type OrderFilter = OrderStatus | "all";
export type OrderStatusCounts = Record<OrderFilter, number>;

const ORDER_ITEM_PRODUCT_COLUMNS = "id,name,item_code,images";

function normalizeOrderItemProduct(row: unknown): OrderItemProduct {
  const parsed = orderItemProductSchema.parse(row);
  return {
    id: parsed.id,
    name: parsed.name,
    item_code: parsed.item_code,
    images: parsed.images.flatMap((value) => safePublicUrl(value) ?? []),
  };
}

export async function getOrders(
  shopId: string,
  {
    page = 1,
    pageSize = 12,
    status = "all",
    createdAfter,
    createdBefore,
  }: {
    page?: number;
    pageSize?: number;
    status?: OrderFilter;
    createdAfter?: string;
    createdBefore?: string;
  } = {},
): Promise<{ orders: Order[]; total: number }> {
  const client = requireSupabase();
  const from = Math.max(0, page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = client
    .from("orders")
    .select(
      `id,shop_id,order_code,customer_name,total_amount,discount_amount,status,created_at,updated_at,expires_at,confirmed_at,cancelled_at,expired_at,order_items(id,order_id,product_id,quantity,unit_price,free_quantity,discount_amount,product:products(${ORDER_ITEM_PRODUCT_COLUMNS}))`,
      { count: "exact" },
    )
    .eq("shop_id", shopId);
  if (status !== "all") query = query.eq("status", status);
  if (createdAfter) query = query.gte("created_at", createdAfter);
  if (createdBefore) query = query.lt("created_at", createdBefore);
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);
  if (error) throw error;
  const orders = (data ?? []).map((row) => ({
    ...orderSchema.parse(row),
    order_items: (row.order_items ?? []).map((item) => ({
      ...item,
      product: Array.isArray(item.product)
        ? normalizeOrderItemProduct(item.product[0])
        : item.product
          ? normalizeOrderItemProduct(item.product)
          : undefined,
    })),
  })) as Order[];
  return { orders, total: count ?? 0 };
}

export async function getOrderStatusCounts(
  shopId: string,
  {
    createdAfter,
    createdBefore,
  }: { createdAfter?: string; createdBefore?: string } = {},
): Promise<OrderStatusCounts> {
  const { data, error } = await requireSupabase().rpc(
    "get_order_status_counts",
    {
      p_shop_id: shopId,
      p_created_after: createdAfter ?? null,
      p_created_before: createdBefore ?? null,
    },
  );
  if (error) throw error;
  return orderStatusCountsSchema.parse(data) as OrderStatusCounts;
}

export async function confirmOrderPayment(
  orderId: string,
): Promise<OrderMutationResult> {
  const { data, error } = await requireSupabase().rpc("confirm_order_payment", {
    target_order_id: orderId,
  });
  if (error) throw error;
  return orderMutationSchema.parse(data) as unknown as OrderMutationResult;
}

export async function cancelOrder(
  orderId: string,
): Promise<OrderMutationResult> {
  const { data, error } = await requireSupabase().rpc("cancel_order", {
    target_order_id: orderId,
  });
  if (error) throw error;
  return orderMutationSchema.parse(data) as unknown as OrderMutationResult;
}

export async function cancelCustomerOrder(
  orderId: string,
  recoveryToken: string,
): Promise<OrderMutationResult> {
  const { data, error } = await requireSupabase().rpc("cancel_customer_order", {
    p_order_id: orderId,
    p_recovery_token: recoveryToken,
  });
  if (error) throw error;
  return orderMutationSchema.parse(data) as unknown as OrderMutationResult;
}
