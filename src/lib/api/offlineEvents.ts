import { z } from "zod";
import type {
  Order,
  OfflineEventOrder,
  OfflineEventSession,
  OfflineEventSyncAcknowledgement,
  PaymentSettings,
  Product,
  PromotionSettings,
} from "../../types/catalog";
import {
  orderItemProductSchema,
  orderSchema,
  orderStatusCountsSchema,
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

const eventOrderItemSchema = z.object({
  id: z.string(),
  order_id: z.string().uuid(),
  product_id: z.string(),
  quantity: z.coerce.number().int().positive(),
  unit_price: z.coerce.number().int().nonnegative(),
  free_quantity: z.coerce.number().int().nonnegative().optional(),
  discount_amount: z.coerce.number().int().nonnegative().optional(),
  product: orderItemProductSchema.optional(),
});

const eventOrderSchema = orderSchema.extend({
  source: z.literal("offline_event"),
  offline_event_session_id: z.string().uuid(),
  offline_event_name: z.string(),
  payment_method: z.enum(["cash", "vietqr"]),
  payment_state: z.enum([
    "awaiting_payment",
    "cash_confirmed",
    "bank_verification_pending",
    "bank_confirmed",
  ]),
  fulfillment_status: z.enum([
    "unfulfilled",
    "preparing",
    "ready",
    "picked_up",
  ]),
  fulfillment_updated_at: z.string().nullable().optional(),
  confirmed_by_email: z.string().nullable().optional(),
  cancelled_by_email: z.string().nullable().optional(),
  fulfillment_updated_by_email: z.string().nullable().optional(),
  order_items: z.array(eventOrderItemSchema),
});

const eventOrderResultSchema = z.object({
  orders: z.array(eventOrderSchema),
  total: z.coerce.number().int().nonnegative(),
  counts: orderStatusCountsSchema,
});

const syncResultSchema = z.object({
  inserted: z.coerce.number().int().nonnegative().optional(),
  updated: z.coerce.number().int().nonnegative().optional(),
  stale: z.coerce.number().int().nonnegative().optional(),
  acknowledged_revisions: z
    .record(z.string(), z.coerce.number().int().nonnegative())
    .optional(),
});

const finalizeResultSchema = z.object({
  sync: syncResultSchema,
  status: z.string(),
});

function offlineOrderPayload(order: OfflineEventOrder) {
  return {
    id: order.id,
    order_code: order.orderCode,
    customer_name: order.customerName,
    total_amount: order.totalAmount,
    status: order.status,
    payment_method: order.paymentMethod,
    payment_state: order.paymentState,
    client_revision: order.clientRevision,
    fulfillment_status: order.fulfillmentStatus,
    fulfillment_updated_at: order.fulfillmentUpdatedAt ?? null,
    confirmed_by_label: order.confirmedByLabel ?? null,
    cancelled_by_label: order.cancelledByLabel ?? null,
    fulfillment_updated_by_label: order.fulfillmentUpdatedByLabel ?? null,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
    items: order.items,
  };
}

function acknowledgementsFor(
  orders: OfflineEventOrder[],
  value: z.infer<typeof syncResultSchema>,
): OfflineEventSyncAcknowledgement[] {
  const acknowledged = value.acknowledged_revisions;
  if (!acknowledged) return [];
  return orders.flatMap((order) =>
    acknowledged[order.id] === undefined
      ? []
      : [{ id: order.id, clientRevision: acknowledged[order.id] }],
  );
}

function exactFinalizationAcknowledgements(
  orders: OfflineEventOrder[],
  value: z.infer<typeof syncResultSchema>,
) {
  const acknowledged = value.acknowledged_revisions ?? {};
  const expected = new Map(
    orders.map((order) => [order.id, order.clientRevision]),
  );
  const exact =
    Object.keys(acknowledged).length === expected.size &&
    Object.entries(acknowledged).every(
      ([id, revision]) => expected.get(id) === revision,
    );
  if (!exact) {
    throw new Error("Offline finalization acknowledgements are incomplete.");
  }
  return acknowledgementsFor(orders, value);
}

function normalizeBundle(
  value: unknown,
  shopSlug: string,
): OfflineEventSession {
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
): Promise<OfflineEventSyncAcknowledgement[]> {
  const { data, error } = await requireSupabase().rpc(
    "sync_offline_event_orders",
    {
      p_session_id: session.id,
      p_device_id: session.deviceId,
      p_orders: orders.map(offlineOrderPayload),
    },
  );
  if (error) throw error;
  const parsed = syncResultSchema.parse(data);
  return acknowledgementsFor(orders, parsed);
}

export async function finalizeOfflineEventSession(
  session: OfflineEventSession,
  orders: OfflineEventOrder[],
): Promise<{
  acknowledgements: OfflineEventSyncAcknowledgement[];
  status: string;
}> {
  const { data, error } = await requireSupabase().rpc(
    "finalize_offline_event_session",
    {
      p_session_id: session.id,
      p_device_id: session.deviceId,
      p_orders: orders.map(offlineOrderPayload),
    },
  );
  if (error) throw error;
  const parsed = finalizeResultSchema.parse(data);
  return {
    acknowledgements: exactFinalizationAcknowledgements(orders, parsed.sync),
    status: parsed.status,
  };
}

export async function getOfflineEventOrders(
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
    status?: "pending" | "confirmed" | "cancelled" | "expired" | "all";
    createdAfter?: string;
    createdBefore?: string;
  } = {},
): Promise<{
  orders: Order[];
  total: number;
  counts: z.infer<typeof orderStatusCountsSchema>;
}> {
  const { data, error } = await requireSupabase().rpc(
    "get_offline_event_orders",
    {
      p_shop_id: shopId,
      p_page: page,
      p_page_size: pageSize,
      p_status: status,
      p_created_after: createdAfter ?? null,
      p_created_before: createdBefore ?? null,
    },
  );
  if (error) throw error;
  return eventOrderResultSchema.parse(data) as {
    orders: Order[];
    total: number;
    counts: z.infer<typeof orderStatusCountsSchema>;
  };
}
