import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (request.method !== "POST") return Response.json({ error: "Method not allowed." }, { status: 405, headers: cors });
    const { orderId, recoveryToken } = await request.json();
    if (!orderId || typeof recoveryToken !== "string" || recoveryToken.length < 32) throw new Error("Missing order credentials.");
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
    if (!publicKey || !privateKey) throw new Error("VAPID keys are not configured.");
    const admin = createClient(url, serviceKey);
    const recoveryTokenHash = await sha256(recoveryToken);
    const { data: order, error: orderError } = await admin.from("orders").select("id, order_code, total_amount, status").eq("id", orderId).eq("status", "pending").eq("recovery_token_hash", recoveryTokenHash).single();
    if (orderError || !order) throw new Error("Pending order not found.");
    const { error: eventError } = await admin.from("order_notification_events").insert({ order_id: order.id });
    if (eventError?.code === "23505") return Response.json({ duplicate: true }, { headers: cors });
    if (eventError) throw eventError;
    const [{ data: subscriptions }, { data: booth }] = await Promise.all([
      admin.from("push_subscriptions").select("endpoint, p256dh, auth"),
      admin.from("booth_settings").select("booth_name, logo_url").limit(1).maybeSingle(),
    ]);
    webpush.setVapidDetails(subject, publicKey, privateKey);
    const payload = JSON.stringify({ title: `New order · ${order.order_code}`, body: `${Number(order.total_amount).toLocaleString("vi-VN")} ₫ awaiting confirmation`, icon: booth?.logo_url, tag: `order-${order.id}`, url: "./admin" });
    const deliveries = await Promise.allSettled((subscriptions || []).map(async (subscription) => {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload);
      } catch (error) {
        const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
        if (statusCode === 404 || statusCode === 410) await admin.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
        throw error;
      }
    }));
    return Response.json({ sent: deliveries.filter((result) => result.status === "fulfilled").length }, { headers: cors });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Notification failed." }, { status: 400, headers: cors });
  }
});
