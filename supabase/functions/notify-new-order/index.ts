import { createClient as defaultCreateClient } from "npm:@supabase/supabase-js@2.110.2";
import webpush from "npm:web-push@3.6.7";

export const clientFactory = { createClient: defaultCreateClient };
export const pushClient = {
  setVapidDetails: webpush.setVapidDetails.bind(webpush),
  sendNotification: webpush.sendNotification.bind(webpush),
};

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
const maxBodyLength = 1_024;
const maxPushSubscriptions = 100;
const pushConcurrency = 8;
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
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function parseBody(request: Request) {
  let raw = "";
  try {
    raw = await request.text();
    if (!raw || raw.length > maxBodyLength) return null;
    const value = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function validPushSubscription(
  value: unknown,
): value is PushSubscriptionRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const subscription = value as Record<string, unknown>;
  if (
    typeof subscription.endpoint !== "string" ||
    subscription.endpoint.length < 1 ||
    subscription.endpoint.length > 2_048 ||
    typeof subscription.p256dh !== "string" ||
    subscription.p256dh.length < 1 ||
    subscription.p256dh.length > 512 ||
    typeof subscription.auth !== "string" ||
    subscription.auth.length < 1 ||
    subscription.auth.length > 512
  ) {
    return false;
  }
  try {
    const endpoint = new URL(subscription.endpoint);
    return !/\s/.test(subscription.endpoint) && endpoint.protocol === "https:";
  } catch {
    return false;
  }
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (cursor < values.length) {
        const index = cursor++;
        results[index] = await mapper(values[index]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

export async function handleNotifyRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (request.method !== "POST") return failure("Method not allowed.", 405);
  if (!siteOrigin) {
    return failure("Order notifications are not configured.", 503);
  }
  const origin = request.headers.get("Origin");
  if (origin && origin !== siteOrigin) {
    return failure("Origin not allowed.", 403);
  }

  const body = await parseBody(request);
  const orderId = typeof body?.orderId === "string" ? body.orderId : "";
  const recoveryToken = typeof body?.recoveryToken === "string"
    ? body.recoveryToken
    : "";
  if (
    !uuidPattern.test(orderId) ||
    recoveryToken.length < 32 ||
    recoveryToken.length > 160
  ) {
    return failure("Invalid order credentials.", 400);
  }

  let admin: any;
  let claimed = false;
  let leaseToken = "";
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
    if (!publicKey || !privateKey) {
      return failure("Order notifications are not configured.", 503);
    }

    if (!url || !serviceKey) {
      return failure("Order notifications are not configured.", 503);
    }
    admin = clientFactory.createClient(url, serviceKey, {
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

    const { data: claim, error: claimError } = await admin.rpc(
      "claim_order_notification_delivery",
      { p_order_id: order.id, p_shop_id: order.shop_id },
    );
    if (claimError) throw claimError;
    const claimOutcome = typeof claim === "object" && claim
      ? String(claim.outcome ?? "")
      : String(claim ?? "");
    if (claimOutcome === "delivered") {
      return Response.json({ duplicate: true }, { headers: cors });
    }
    if (claimOutcome === "in_progress") {
      return Response.json(
        { duplicate: true, inProgress: true },
        { headers: cors },
      );
    }
    if (claimOutcome !== "claimed" || typeof claim.lease_token !== "string") {
      throw new Error("Notification claim failed");
    }
    leaseToken = claim.lease_token;
    const retryEndpoints = Array.isArray(claim.retry_endpoints)
      ? claim.retry_endpoints.filter(
        (endpoint: unknown): endpoint is string => typeof endpoint === "string",
      )
      : [];
    claimed = true;

    const [subscriptionResult, boothResult] = await Promise.all([
      admin
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("shop_id", order.shop_id)
        .limit(maxPushSubscriptions + 1),
      admin
        .from("booth_settings")
        .select("booth_name, logo_url")
        .eq("shop_id", order.shop_id)
        .maybeSingle(),
    ]);
    if (subscriptionResult.error) throw subscriptionResult.error;
    if (boothResult.error) throw boothResult.error;
    const subscriptionRows = subscriptionResult.data || [];
    if (subscriptionRows.length > maxPushSubscriptions) {
      throw new Error("Push subscription limit exceeded");
    }
    const retryEndpointSet = new Set(retryEndpoints);
    const subscriptions = subscriptionRows.filter(
      (subscription: { endpoint?: unknown }) =>
        retryEndpointSet.size === 0 ||
        (typeof subscription.endpoint === "string" &&
          retryEndpointSet.has(subscription.endpoint)),
    );
    const booth = boothResult.data;
    pushClient.setVapidDetails(subject, publicKey, privateKey);
    const payload = JSON.stringify({
      title: `New order · ${order.order_code}`,
      body: `${
        Number(order.total_amount).toLocaleString(
          "vi-VN",
        )
      } ₫ awaiting confirmation`,
      icon: booth?.logo_url,
      tag: `order-${order.id}`,
      url: "./admin",
    });
    const deliveries = await mapWithConcurrency(
      subscriptions,
      pushConcurrency,
      async (subscription: unknown) => {
        if (!validPushSubscription(subscription)) {
          const endpoint = subscription && typeof subscription === "object" &&
              "endpoint" in subscription &&
              typeof subscription.endpoint === "string"
            ? subscription.endpoint
            : null;
          if (endpoint !== null) {
            await admin
              .from("push_subscriptions")
              .delete()
              .eq("shop_id", order.shop_id)
              .eq("endpoint", endpoint);
          }
          return { endpoint: endpoint ?? "", sent: false, retry: false };
        }
        try {
          await pushClient.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            payload,
          );
          return { endpoint: subscription.endpoint, sent: true, retry: false };
        } catch (error) {
          const statusCode =
            typeof error === "object" && error && "statusCode" in error
              ? Number(error.statusCode)
              : 0;
          const expired = statusCode === 404 || statusCode === 410;
          if (expired) {
            await admin
              .from("push_subscriptions")
              .delete()
              .eq("shop_id", order.shop_id)
              .eq("endpoint", subscription.endpoint);
          }
          return {
            endpoint: subscription.endpoint,
            sent: false,
            retry: !expired,
          };
        }
      },
    );
    const failedEndpoints = deliveries
      .filter((delivery) => delivery.retry)
      .map((delivery) => delivery.endpoint);
    const { data: completed, error: completionError } = await admin.rpc(
      "complete_order_notification_delivery",
      {
        p_order_id: order.id,
        p_lease_token: leaseToken,
        p_delivered: failedEndpoints.length === 0,
        p_error: failedEndpoints.length === 0
          ? null
          : `${failedEndpoints.length} of ${deliveries.length} push deliveries failed`,
        p_failed_endpoints: failedEndpoints,
      },
    );
    if (completionError) throw completionError;
    if (!completed) {
      claimed = false;
      return Response.json(
        { superseded: true },
        { status: 202, headers: cors },
      );
    }
    claimed = false;
    if (failedEndpoints.length > 0) {
      return failure("The notification could not be completed.", 503);
    }
    return Response.json(
      {
        sent: deliveries.filter((delivery) => delivery.sent).length,
      },
      { headers: cors },
    );
  } catch (error) {
    if (claimed && admin) {
      await admin
        .rpc("complete_order_notification_delivery", {
          p_order_id: orderId,
          p_lease_token: leaseToken,
          p_delivered: false,
          p_error: error instanceof Error ? error.message : "Unknown failure",
          p_failed_endpoints: null,
        })
        .catch(() => undefined);
    }
    console.error(
      "notify-new-order failed",
      error instanceof Error ? error.message : "Unknown failure",
    );
    return failure("The notification could not be completed.", 503);
  }
}

if (import.meta.main) Deno.serve(handleNotifyRequest);
