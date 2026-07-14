import { createClient as defaultCreateClient } from "npm:@supabase/supabase-js@2.110.2";
import webpush from "npm:web-push@3.6.7";

export const clientFactory = { createClient: defaultCreateClient };

const siteUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "";
const siteOrigin = (() => {
  try {
    return new URL(siteUrl).origin;
  } catch {
    return "";
  }
})();
const cors = {
  "Access-Control-Allow-Origin": siteOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type PushSubscriptionRecord = {
  endpoint: string;
  p256dh: string;
  auth: string;
};
const failure = (error: string, status: number) =>
  Response.json({ error }, { status, headers: cors });

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function parseBody(request: Request) {
  try {
    const value = await request.json();
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function handleNotifyRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: cors });
  if (request.method !== "POST") return failure("Method not allowed.", 405);
  if (!siteOrigin)
    return failure("Order notifications are not configured.", 503);
  const origin = request.headers.get("Origin");
  if (origin && origin !== siteOrigin)
    return failure("Origin not allowed.", 403);

  const body = await parseBody(request);
  const orderId = typeof body?.orderId === "string" ? body.orderId : "";
  const recoveryToken =
    typeof body?.recoveryToken === "string" ? body.recoveryToken : "";
  if (!uuidPattern.test(orderId) || recoveryToken.length < 32)
    return failure("Invalid order credentials.", 400);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
    if (!publicKey || !privateKey)
      return failure("Order notifications are not configured.", 503);

    const admin = clientFactory.createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const recoveryTokenHash = await sha256(recoveryToken);
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, shop_id, order_code, total_amount, status")
      .eq("id", orderId)
      .eq("status", "pending")
      .eq("recovery_token_hash", recoveryTokenHash)
      .single();
    if (orderError || !order) return failure("Pending order not found.", 404);

    const { error: eventError } = await admin
      .from("order_notification_events")
      .insert({ order_id: order.id, shop_id: order.shop_id });
    if (eventError?.code === "23505")
      return Response.json({ duplicate: true }, { headers: cors });
    if (eventError) throw eventError;

    const [{ data: subscriptions }, { data: booth }] = await Promise.all([
      admin
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("shop_id", order.shop_id),
      admin
        .from("booth_settings")
        .select("booth_name, logo_url")
        .eq("shop_id", order.shop_id)
        .maybeSingle(),
    ]);
    webpush.setVapidDetails(subject, publicKey, privateKey);
    const payload = JSON.stringify({
      title: `New order · ${order.order_code}`,
      body: `${Number(order.total_amount).toLocaleString("vi-VN")} ₫ awaiting confirmation`,
      icon: booth?.logo_url,
      tag: `order-${order.id}`,
      url: "./admin",
    });
    const deliveries = await Promise.allSettled(
      (subscriptions || []).map(
        async (subscription: PushSubscriptionRecord) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: { p256dh: subscription.p256dh, auth: subscription.auth },
              },
              payload,
            );
          } catch (error) {
            const statusCode =
              typeof error === "object" && error && "statusCode" in error
                ? Number(error.statusCode)
                : 0;
            if (statusCode === 404 || statusCode === 410)
              await admin
                .from("push_subscriptions")
                .delete()
                .eq("endpoint", subscription.endpoint);
            throw error;
          }
        },
      ),
    );
    return Response.json(
      {
        sent: deliveries.filter(
          (result: PromiseSettledResult<void>) => result.status === "fulfilled",
        ).length,
      },
      { headers: cors },
    );
  } catch (error) {
    console.error(
      "notify-new-order failed",
      error instanceof Error ? error.message : "Unknown failure",
    );
    return failure("The notification could not be completed.", 400);
  }
}

if (import.meta.main) Deno.serve(handleNotifyRequest);
