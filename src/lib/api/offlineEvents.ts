import { z } from "zod";
import type {
  OfflineEventOrder,
  OfflineEventSession,
  PaymentSettings,
  Product,
  PromotionSettings,
} from "../../types/catalog";
import {
  paymentSettingsSchema,
  productRowSchema,
  promotionSettingsSchema,
} from "../schemas";
import { requireSupabase } from "./shared";

const serverSessionSchema = z.object({
  id: z.string().uuid(),
  shop_id: z.string().uuid(),
  device_id: z.string().uuid(),
  name: z.string(),
  status: z.enum(["active", "closed"]),
  payment_snapshot: paymentSettingsSchema,
  promotion_snapshot: promotionSettingsSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

const serverAllocationSchema = z.object({
  product_id: z.string(),
  quantity_allocated: z.coerce.number().int().positive(),
  quantity_sold: z.coerce.number().int().nonnegative(),
  product_snapshot: productRowSchema,
});

const eventBundleSchema = z.object({
  session: serverSessionSchema,
  allocations: z.array(serverAllocationSchema),
});

function normalizeBundle(value: unknown, shopSlug: string): OfflineEventSession {
  const bundle = eventBundleSchema.parse(value);
  return {
    version: 1,
    id: bundle.session.id,
    shopId: bundle.session.shop_id,
    shopSlug,
    deviceId: bundle.session.device_id,
    name: bundle.session.name,
    status: bundle.session.status,
    payment: bundle.session.payment_snapshot as PaymentSettings,
    promotion: bundle.session.promotion_snapshot as PromotionSettings,
    allocations: bundle.allocations.map((allocation) => ({
      product: allocation.product_snapshot as Product,
      quantityAllocated: allocation.quantity_allocated,
      quantitySold: allocation.quantity_sold,
    })),
    createdAt: bundle.session.created_at,
    updatedAt: bundle.session.updated_at,
  };
}

export async function startOfflineEventSession({
  shopId,
  shopSlug,
  deviceId,
  name,
  products,
  payment,
  promotion,
}: {
  shopId: string;
  shopSlug: string;
  deviceId: string;
  name: string;
  products: Array<{ id: string; quantity: number }>;
  payment: PaymentSettings;
  promotion: PromotionSettings;
}): Promise<OfflineEventSession> {
  const { data, error } = await requireSupabase().rpc(
    "start_offline_event_session",
    {
      p_shop_id: shopId,
      p_device_id: deviceId,
      p_name: name,
      p_allocations: products.map((product) => ({
        product_id: product.id,
        quantity: product.quantity,
      })),
      p_payment_snapshot: payment,
      p_promotion_snapshot: promotion,
    },
  );
  if (error) throw error;
  return normalizeBundle(data, shopSlug);
}

export async function recoverOfflineEventSession(
  shopId: string,
  shopSlug: string,
  deviceId: string,
): Promise<OfflineEventSession | null> {
  const { data, error } = await requireSupabase().rpc(
    "get_active_offline_event_session",
    { p_shop_id: shopId, p_device_id: deviceId },
  );
  if (error) throw error;
  return data ? normalizeBundle(data, shopSlug) : null;
}

export async function syncOfflineEventOrders(
  session: OfflineEventSession,
  orders: OfflineEventOrder[],
): Promise<void> {
  const { error } = await requireSupabase().rpc("sync_offline_event_orders", {
    p_session_id: session.id,
    p_device_id: session.deviceId,
    p_orders: orders.map((order) => ({
      id: order.id,
      order_code: order.orderCode,
      customer_name: order.customerName,
      total_amount: order.totalAmount,
      status: order.status,
      payment_method: order.paymentMethod,
      payment_state: order.paymentState,
      created_at: order.createdAt,
      updated_at: order.updatedAt,
      items: order.items,
    })),
  });
  if (error) throw error;
}

export async function closeOfflineEventSession(
  session: OfflineEventSession,
): Promise<void> {
  const { error } = await requireSupabase().rpc(
    "close_offline_event_session",
    { p_session_id: session.id, p_device_id: session.deviceId },
  );
  if (error) throw error;
}
