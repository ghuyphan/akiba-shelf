import { createClient as defaultCreateClient } from "npm:@supabase/supabase-js@2.110.2";
import webpush from "npm:web-push@3.6.7";
import { jsonFailure, readBoundedJson, requiredEnv } from "../_shared/http.ts";
import {
  inspectPushEndpoint,
  validPushKeyMaterial,
} from "../_shared/pushEndpoint.ts";

export const clientFactory = { createClient: defaultCreateClient };
export const pushClient = {
  setVapidDetails: webpush.setVapidDetails.bind(webpush),
  sendNotification: webpush.sendNotification.bind(webpush),
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxBodyBytes = 2 * 1024;
const maxPushSubscriptions = 100;
const pushConcurrency = 8;
const jobConcurrency = 3;
const responseHeaders = { "Cache-Control": "no-store" };
const pushTimeoutMs = 5_000;

type PushSubscriptionRecord = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type ClaimedJob = {
  order_id: string;
  shop_id: string;
  lease_token: string;
  retry_endpoints: string[];
  attempt_number: number;
};

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

async function inspectPushSubscription(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return "invalid" as const;
  const subscription = value as Record<string, unknown>;
  if (
    typeof subscription.endpoint !== "string" ||
    typeof subscription.p256dh !== "string" ||
    subscription.p256dh.length < 1 ||
    subscription.p256dh.length > 512 ||
    typeof subscription.auth !== "string" ||
    subscription.auth.length < 1 ||
    subscription.auth.length > 512 ||
    !(await validPushKeyMaterial(subscription.p256dh, subscription.auth))
  ) {
    return "invalid" as const;
  }
  return (await inspectPushEndpoint(subscription.endpoint)).status;
}

async function deleteSubscriptionBestEffort(
  admin: any,
  shopId: string,
  endpoint: string,
) {
  try {
    const { error } = await admin
      .from("push_subscriptions")
      .delete()
      .eq("shop_id", shopId)
      .eq("endpoint", endpoint);
    if (error) {
      console.warn("could not remove invalid push subscription", {
        shopId,
        error: error.message,
      });
    }
  } catch {
    console.warn("could not remove invalid push subscription", { shopId });
  }
}

async function completeJob(
  admin: any,
  job: ClaimedJob,
  delivered: boolean,
  errorCode: string | null,
  failedEndpoints: string[],
  sentCount = 0,
) {
  const { data, error } = await admin.rpc(
    "complete_order_notification_delivery",
    {
      p_order_id: job.order_id,
      p_lease_token: job.lease_token,
      p_delivered: delivered,
      p_error: errorCode,
      p_failed_endpoints: failedEndpoints,
      p_sent_count: sentCount,
    },
  );
  if (error) throw error;
  return Boolean(data);
}

async function processClaimedJob(
  admin: any,
  job: ClaimedJob,
  vapid: { publicKey: string; privateKey: string; subject: string },
) {
  try {
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, shop_id, order_code, total_amount, status")
      .eq("id", job.order_id)
      .eq("shop_id", job.shop_id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order || order.status !== "pending") {
      await completeJob(admin, job, true, "order_not_pending", []);
      return { outcome: "skipped", sent: 0 };
    }

    const [subscriptionResult, boothResult] = await Promise.all([
      admin.rpc("get_active_push_subscriptions", {
        p_shop_id: job.shop_id,
        p_limit: maxPushSubscriptions,
      }),
      admin
        .from("booth_settings")
        .select("booth_name, logo_url")
        .eq("shop_id", job.shop_id)
        .maybeSingle(),
    ]);
    if (subscriptionResult.error) throw subscriptionResult.error;
    if (boothResult.error) throw boothResult.error;

    const retryEndpointSet = new Set(job.retry_endpoints ?? []);
    const subscriptions = (subscriptionResult.data ?? []).filter(
      (subscription: { endpoint?: unknown }) =>
        retryEndpointSet.size === 0 ||
        (typeof subscription.endpoint === "string" &&
          retryEndpointSet.has(subscription.endpoint)),
    );
    pushClient.setVapidDetails(
      vapid.subject,
      vapid.publicKey,
      vapid.privateKey,
    );
    const payload = JSON.stringify({
      title: `New order · ${order.order_code}`,
      body: `${Number(order.total_amount).toLocaleString("vi-VN")} ₫ awaiting confirmation`,
      icon: boothResult.data?.logo_url,
      tag: `order-${order.id}`,
      url: "./admin",
    });

    const deliveries = await mapWithConcurrency(
      subscriptions,
      pushConcurrency,
      async (subscription: unknown) => {
        const endpoint =
          subscription &&
          typeof subscription === "object" &&
          "endpoint" in subscription &&
          typeof subscription.endpoint === "string"
            ? subscription.endpoint
            : "";
        const validation = await inspectPushSubscription(subscription);
        if (validation !== "valid") {
          if (endpoint && validation === "invalid") {
            await deleteSubscriptionBestEffort(admin, job.shop_id, endpoint);
          }
          return {
            endpoint,
            sent: false,
            retry: validation === "unavailable",
          };
        }
        const validSubscription = subscription as PushSubscriptionRecord;
        try {
          await pushClient.sendNotification(
            {
              endpoint: validSubscription.endpoint,
              keys: {
                p256dh: validSubscription.p256dh,
                auth: validSubscription.auth,
              },
            },
            payload,
            { timeout: pushTimeoutMs },
          );
          return {
            endpoint: validSubscription.endpoint,
            sent: true,
            retry: false,
          };
        } catch (error) {
          const statusCode =
            typeof error === "object" && error && "statusCode" in error
              ? Number(error.statusCode)
              : 0;
          const expired = statusCode === 404 || statusCode === 410;
          if (expired) {
            await deleteSubscriptionBestEffort(
              admin,
              job.shop_id,
              validSubscription.endpoint,
            );
          }
          return {
            endpoint: validSubscription.endpoint,
            sent: false,
            retry: !expired,
          };
        }
      },
    );
    const failedEndpoints = deliveries
      .filter((delivery) => delivery.retry)
      .map((delivery) => delivery.endpoint);
    const sentEndpoints = deliveries
      .filter((delivery) => delivery.sent)
      .map((delivery) => delivery.endpoint);
    const sentCount = sentEndpoints.length;
    if (sentEndpoints.length > 0) {
      const { error: touchError } = await admin.rpc(
        "touch_push_subscriptions",
        {
          p_shop_id: job.shop_id,
          p_endpoints: sentEndpoints,
        },
      );
      if (touchError) {
        console.warn("could not refresh push subscription activity", {
          orderId: job.order_id,
        });
      }
    }
    const terminalWithoutDelivery =
      failedEndpoints.length === 0 && sentCount === 0;
    const completed = await completeJob(
      admin,
      job,
      failedEndpoints.length === 0,
      failedEndpoints.length > 0
        ? "push_delivery_failed"
        : terminalWithoutDelivery
          ? "no_valid_subscriptions"
          : null,
      failedEndpoints,
      sentCount,
    );
    if (!completed) return { outcome: "superseded", sent: 0 };
    return {
      outcome:
        failedEndpoints.length > 0
          ? "retry_scheduled"
          : terminalWithoutDelivery
            ? "skipped"
            : "delivered",
      sent: sentCount,
    };
  } catch (error) {
    await completeJob(
      admin,
      job,
      false,
      "notification_job_failed",
      job.retry_endpoints,
    ).catch(() => undefined);
    console.error("notification job failed", {
      orderId: job.order_id,
      attempt: job.attempt_number,
      error: error instanceof Error ? error.message : "Unknown failure",
    });
    return { outcome: "retry_scheduled", sent: 0 };
  }
}

function normalizeClaim(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const claim = value as Record<string, unknown>;
  if (
    typeof claim.lease_token !== "string" ||
    !uuidPattern.test(claim.lease_token)
  )
    return null;
  const orderId = typeof claim.order_id === "string" ? claim.order_id : "";
  const shopId = typeof claim.shop_id === "string" ? claim.shop_id : "";
  if (!uuidPattern.test(orderId) || !uuidPattern.test(shopId)) return null;
  return {
    order_id: orderId,
    shop_id: shopId,
    lease_token: claim.lease_token,
    retry_endpoints: Array.isArray(claim.retry_endpoints)
      ? claim.retry_endpoints.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    attempt_number: Number.isSafeInteger(claim.attempt_number)
      ? Number(claim.attempt_number)
      : 1,
  } satisfies ClaimedJob;
}

export async function handleNotifyRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return jsonFailure("Method not allowed.", 405, responseHeaders);
  }

  const workerSecret = Deno.env.get("NOTIFICATION_WORKER_SECRET")?.trim();
  if (
    !workerSecret ||
    request.headers.get("x-notification-worker-secret") !== workerSecret
  ) {
    return jsonFailure("Worker authentication required.", 401, responseHeaders);
  }
  const body = await readBoundedJson(request, maxBodyBytes);
  if (!body || body.action !== "drain") {
    return jsonFailure("Invalid worker request.", 400, responseHeaders);
  }

  const env = requiredEnv([
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
  ]);
  if (!env) {
    return jsonFailure(
      "Order notifications are not configured.",
      503,
      responseHeaders,
    );
  }
  const subject =
    Deno.env.get("VAPID_SUBJECT")?.trim() || "mailto:admin@example.com";
  const admin = clientFactory.createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const vapid = {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject,
  };

  try {
    const batchSize = Number.isSafeInteger(body.batchSize)
      ? Math.max(1, Math.min(Number(body.batchSize), jobConcurrency))
      : jobConcurrency;
    const { data, error } = await admin.rpc("claim_order_notification_batch", {
      p_batch_size: batchSize,
    });
    if (error) throw error;
    const jobs = (Array.isArray(data) ? data : [])
      .map((value) => normalizeClaim(value))
      .filter((value): value is ClaimedJob => value !== null);
    const results = await mapWithConcurrency(jobs, jobConcurrency, (job) =>
      processClaimedJob(admin, job, vapid),
    );
    return Response.json(
      { claimed: jobs.length, results },
      {
        headers: responseHeaders,
      },
    );
  } catch (error) {
    console.error(
      "notify-new-order failed",
      error instanceof Error ? error.message : "Unknown failure",
    );
    return jsonFailure(
      "The notification worker could not run.",
      503,
      responseHeaders,
    );
  }
}

if (import.meta.main) Deno.serve(handleNotifyRequest);
