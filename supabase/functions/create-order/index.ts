import { createClient as defaultCreateClient } from "npm:@supabase/supabase-js@2.110.2";

type CheckoutRpcResult = {
  data: unknown;
  error: { message?: string } | null;
};

type CheckoutAdminClient = {
  rpc: (
    name: string,
    params: Record<string, unknown>,
  ) => PromiseLike<CheckoutRpcResult>;
};

export const clientFactory = {
  createClient(
    url: string,
    key: string,
    options: { auth: { autoRefreshToken: boolean; persistSession: boolean } },
  ): CheckoutAdminClient {
    return defaultCreateClient(url, key, options) as unknown as CheckoutAdminClient;
  },
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
  "Cache-Control": "no-store",
  Vary: "Origin",
};
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const maxBodyLength = 32 * 1024;

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
  let raw = "";
  try {
    raw = await request.text();
  } catch {
    return null;
  }
  if (!raw || raw.length > maxBodyLength) return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function validItems(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= 50 &&
    value.every((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      const row = item as Record<string, unknown>;
      return (
        typeof row.product_id === "string" &&
        row.product_id.length >= 1 &&
        row.product_id.length <= 160 &&
        Number.isSafeInteger(row.quantity) &&
        Number(row.quantity) > 0 &&
        Number(row.quantity) <= 999 &&
        (row.reward_quantity === undefined ||
          (Number.isSafeInteger(row.reward_quantity) &&
            Number(row.reward_quantity) >= 0 &&
            Number(row.reward_quantity) <= Number(row.quantity)))
      );
    })
  );
}

function clientAddress(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function publicError(message: string) {
  const known = [
    "Too many active checkout reservations",
    "Too many checkout attempts",
    "Shop not found or inactive",
    "read-only demo",
    "Cart must contain",
    "Cart contains",
    "sold out",
    "stock",
    "promotion",
  ];
  return known.some((fragment) =>
    message.toLowerCase().includes(fragment.toLowerCase()),
  )
    ? message
    : "The order could not be created. Review the cart and try again.";
}

export async function handleCreateOrderRequest(
  request: Request,
): Promise<Response> {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return failure("Method not allowed.", 405);
  if (!siteOrigin) return failure("Checkout is not configured.", 503);
  if (request.headers.get("Origin") !== siteOrigin)
    return failure("Origin not allowed.", 403);

  const body = await parseBody(request);
  const shopSlug =
    typeof body?.shopSlug === "string" ? body.shopSlug.trim().toLowerCase() : "";
  const customerName =
    typeof body?.customerName === "string" ? body.customerName.trim() : "";
  const clientRequestId =
    typeof body?.clientRequestId === "string" ? body.clientRequestId : "";
  const recoveryToken =
    typeof body?.recoveryToken === "string" ? body.recoveryToken : "";
  const items = body?.items;
  if (
    !slugPattern.test(shopSlug) ||
    customerName.length > 30 ||
    !uuidPattern.test(clientRequestId) ||
    recoveryToken.length < 32 ||
    recoveryToken.length > 160 ||
    !validItems(items)
  ) {
    return failure("Invalid checkout request.", 400);
  }

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!url || !serviceKey) return failure("Checkout is not configured.", 503);
    const salt = Deno.env.get("CHECKOUT_RATE_LIMIT_SALT") || serviceKey;
    const fingerprintHash = await sha256(
      `${salt}:${clientAddress(request)}`,
    );
    const admin = clientFactory.createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await admin.rpc("create_order_rate_limited", {
      p_shop_slug: shopSlug,
      p_customer_name: customerName || null,
      p_items: items,
      p_client_request_id: clientRequestId,
      p_recovery_token: recoveryToken,
      p_fingerprint_hash: fingerprintHash,
    });
    if (error) {
      const message = publicError(error.message || "");
      return failure(message, message.startsWith("Too many") ? 429 : 409);
    }
    const order = Array.isArray(data) ? data[0] : data;
    if (!order) return failure("The order response was incomplete. Retry checkout.", 502);
    return Response.json(order, { headers: cors });
  } catch (error) {
    console.error(
      "create-order failed",
      error instanceof Error ? error.message : "Unknown failure",
    );
    return failure("Checkout is temporarily unavailable. Please retry.", 503);
  }
}

if (import.meta.main) Deno.serve(handleCreateOrderRequest);
