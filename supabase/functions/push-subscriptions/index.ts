import { createClient as defaultCreateClient } from "npm:@supabase/supabase-js@2.110.2";
import {
  configuredOrigins,
  corsHeaders,
  jsonFailure,
  normalizeOrigin,
  readBoundedJson,
  requiredEnv,
} from "../_shared/http.ts";
import {
  normalizePushEndpoint,
  validPushKeyMaterial,
  validatePushEndpoint,
} from "../_shared/pushEndpoint.ts";

export const clientFactory = { createClient: defaultCreateClient };

const allowedOrigins = configuredOrigins(
  Deno.env.get("PUBLIC_SITE_URL") ?? "",
  Deno.env.get("CHECKOUT_ALLOWED_ORIGINS") ?? "",
);
const maxBodyBytes = 8 * 1024;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function rpcMessage(error: unknown) {
  return error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
    ? error.message
    : "";
}

export async function handlePushSubscriptionRequest(
  request: Request,
): Promise<Response> {
  const requestOrigin = normalizeOrigin(request.headers.get("Origin") ?? "");
  const cors = corsHeaders(allowedOrigins, requestOrigin);
  if (!allowedOrigins.size) {
    return jsonFailure("Push subscriptions are not configured.", 503, cors);
  }
  if (!requestOrigin || !allowedOrigins.has(requestOrigin)) {
    return jsonFailure("Origin not allowed.", 403, cors);
  }
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: cors });
  if (request.method !== "POST") {
    return jsonFailure("Method not allowed.", 405, cors);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) return jsonFailure("Authentication required.", 401, cors);
  const body = await readBoundedJson(request, maxBodyBytes);
  const action = typeof body?.action === "string" ? body.action : "";
  const shopId = typeof body?.shopId === "string" ? body.shopId : "";
  const rawEndpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  if (
    !["register", "unregister", "status"].includes(action) ||
    !uuidPattern.test(shopId)
  ) {
    return jsonFailure("Invalid push subscription request.", 400, cors);
  }

  const endpoint =
    action === "register"
      ? await validatePushEndpoint(rawEndpoint)
      : normalizePushEndpoint(rawEndpoint);
  if (!endpoint) {
    return jsonFailure("Invalid push endpoint.", 400, cors);
  }

  const env = requiredEnv([
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]);
  if (!env) {
    return jsonFailure("Push subscriptions are not configured.", 503, cors);
  }

  try {
    const caller = clientFactory.createClient(
      env.SUPABASE_URL,
      env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: authorization } } },
    );
    const admin = clientFactory.createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data: authData, error: authError } = await caller.auth.getUser();
    if (authError || !authData.user) {
      return jsonFailure("Authentication required.", 401, cors);
    }

    if (action === "status") {
      const { count, error } = await admin
        .from("push_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", authData.user.id)
        .eq("shop_id", shopId)
        .eq("endpoint", endpoint);
      if (error) throw error;
      if (count) {
        const { error: touchError } = await admin.rpc(
          "touch_push_subscriptions",
          { p_shop_id: shopId, p_endpoints: [endpoint] },
        );
        if (touchError) throw touchError;
      }
      return Response.json({ enabled: Boolean(count) }, { headers: cors });
    }

    if (action === "unregister") {
      const { error } = await admin.rpc("unregister_push_subscription", {
        p_user_id: authData.user.id,
        p_shop_id: shopId,
        p_endpoint: endpoint,
      });
      if (error) throw error;
      const { count, error: countError } = await admin
        .from("push_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("endpoint", endpoint);
      if (countError) throw countError;
      return Response.json(
        { outcome: "unregistered", unsubscribe: !count },
        { headers: cors },
      );
    }

    const p256dh = typeof body?.p256dh === "string" ? body.p256dh : "";
    const auth = typeof body?.auth === "string" ? body.auth : "";
    const userAgent =
      typeof body?.userAgent === "string"
        ? body.userAgent
        : (request.headers.get("User-Agent") ?? "");
    if (
      p256dh.length < 1 ||
      p256dh.length > 512 ||
      auth.length < 1 ||
      auth.length > 512 ||
      !(await validPushKeyMaterial(p256dh, auth)) ||
      userAgent.length > 1024
    ) {
      return jsonFailure("Invalid push subscription.", 400, cors);
    }

    const { error } = await admin.rpc("register_push_subscription", {
      p_user_id: authData.user.id,
      p_shop_id: shopId,
      p_endpoint: endpoint,
      p_p256dh: p256dh,
      p_auth: auth,
      p_user_agent: userAgent,
    });
    if (error) {
      const message = rpcMessage(error);
      if (message === "Push subscription limit reached") {
        return jsonFailure(message, 409, cors);
      }
      if (message === "Active shop member access required") {
        return jsonFailure(message, 403, cors);
      }
      throw error;
    }
    return Response.json({ outcome: "registered" }, { headers: cors });
  } catch (error) {
    console.error(
      "push-subscriptions failed",
      error instanceof Error ? error.message : "Unknown failure",
    );
    return jsonFailure(
      "The push subscription could not be updated.",
      503,
      cors,
    );
  }
}

if (import.meta.main) Deno.serve(handlePushSubscriptionRequest);
