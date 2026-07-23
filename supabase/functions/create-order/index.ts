import { createClient as defaultCreateClient } from "npm:@supabase/supabase-js@2.110.2";
import {
  configuredOrigins,
  corsHeaders,
  jsonFailure,
  normalizeOrigin,
  readBoundedJson,
  requiredEnv,
} from "../_shared/http.ts";

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
    return defaultCreateClient(
      url,
      key,
      options,
    ) as unknown as CheckoutAdminClient;
  },
};

const siteOrigins = configuredOrigins(
  Deno.env.get("PUBLIC_SITE_URL") ?? "",
  Deno.env.get("CHECKOUT_ALLOWED_ORIGINS") ?? "",
);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const maxBodyLength = 32 * 1024;
const publicRpcErrors = new Map<string, { error: string; status: number }>([
  [
    "Too many active checkout reservations. Complete or cancel an existing order first.",
    {
      error:
        "Too many active checkout reservations. Complete or cancel an existing order first.",
      status: 429,
    },
  ],
  [
    "Too many checkout attempts. Please wait a few minutes and try again.",
    {
      error:
        "Too many checkout attempts. Please wait a few minutes and try again.",
      status: 429,
    },
  ],
  [
    "Too many expired checkout reservations. Please wait before trying again.",
    {
      error:
        "Too many expired checkout reservations. Please wait before trying again.",
      status: 429,
    },
  ],
  [
    "Checkout is temporarily busy. Please try again shortly.",
    {
      error: "Checkout is temporarily busy. Please try again shortly.",
      status: 503,
    },
  ],
  [
    "Shop not found or inactive",
    {
      error: "Shop not found or inactive",
      status: 409,
    },
  ],
  [
    "This storefront is a read-only demo and does not accept orders",
    {
      error: "This storefront is a read-only demo and does not accept orders",
      status: 409,
    },
  ],
  [
    "Cart must contain between 1 and 50 items",
    { error: "Cart must contain between 1 and 50 items", status: 409 },
  ],
  [
    "Cart contains an invalid item",
    { error: "Cart contains an invalid item", status: 409 },
  ],
  [
    "One or more items are sold out or no longer have enough stock",
    {
      error: "One or more items are sold out or no longer have enough stock",
      status: 409,
    },
  ],
  [
    "This promotion is no longer active",
    { error: "This promotion is no longer active", status: 409 },
  ],
  [
    "Cart contains an invalid reward item",
    { error: "Cart contains an invalid reward item", status: 409 },
  ],
  [
    "Cart contains too many free reward items",
    { error: "Cart contains too many free reward items", status: 409 },
  ],
]);

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function validItems(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= 50 &&
    value.every((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return false;
      }
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

function publicError(message: string) {
  return (
    publicRpcErrors.get(message) ?? {
      error: "The order could not be created. Review the cart and try again.",
      status: 409,
    }
  );
}

function forwardedClientIpHint(request: Request) {
  // Supabase's location example reads the leftmost value; this remains a
  // supplemental abuse signal, never the only checkout authorization boundary.
  const value = request.headers
    .get("x-forwarded-for")
    ?.split(",", 1)[0]
    ?.trim();
  if (!value || value.length > 64 || !/^[0-9a-f:.]+$/i.test(value)) {
    return null;
  }
  return value.toLowerCase();
}

export async function handleCreateOrderRequest(
  request: Request,
): Promise<Response> {
  const requestOrigin = normalizeOrigin(request.headers.get("Origin") ?? "");
  const cors = corsHeaders(siteOrigins, requestOrigin);
  if (!siteOrigins.size) {
    return jsonFailure("Checkout is not configured.", 503, cors);
  }
  if (!requestOrigin || !siteOrigins.has(requestOrigin)) {
    return jsonFailure("Origin not allowed.", 403, cors);
  }
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (request.method !== "POST") {
    return jsonFailure("Method not allowed.", 405, cors);
  }

  const body = await readBoundedJson(request, maxBodyLength);
  const shopSlug =
    typeof body?.shopSlug === "string"
      ? body.shopSlug.trim().toLowerCase()
      : "";
  const customerName =
    typeof body?.customerName === "string" ? body.customerName.trim() : "";
  const clientRequestId =
    typeof body?.clientRequestId === "string" ? body.clientRequestId : "";
  const recoveryToken =
    typeof body?.recoveryToken === "string" ? body.recoveryToken : "";
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId : null;
  const items = body?.items;
  if (
    !slugPattern.test(shopSlug) ||
    customerName.length > 30 ||
    !uuidPattern.test(clientRequestId) ||
    (deviceId !== null && !uuidPattern.test(deviceId)) ||
    recoveryToken.length < 32 ||
    recoveryToken.length > 160 ||
    !validItems(items)
  ) {
    return jsonFailure("Invalid checkout request.", 400, cors);
  }

  try {
    const env = requiredEnv([
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "CHECKOUT_RATE_LIMIT_SALT",
    ]);
    if (!env) {
      return jsonFailure("Checkout is not configured.", 503, cors);
    }
    const url = env.SUPABASE_URL;
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const fingerprintHash = await sha256(
      `${env.CHECKOUT_RATE_LIMIT_SALT}:checkout:${shopSlug}:${recoveryToken}`,
    );
    const deviceHash = await sha256(
      deviceId
        ? `${env.CHECKOUT_RATE_LIMIT_SALT}:device:${deviceId}`
        : `${env.CHECKOUT_RATE_LIMIT_SALT}:legacy-device:${fingerprintHash}`,
    );
    const ipHint = forwardedClientIpHint(request);
    const ipHash = ipHint
      ? await sha256(`${env.CHECKOUT_RATE_LIMIT_SALT}:ip:${ipHint}`)
      : null;
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
      p_device_hash: deviceHash,
      p_ip_hash: ipHash,
    });
    if (error) {
      const publicFailure = publicError(error.message || "");
      return jsonFailure(publicFailure.error, publicFailure.status, cors);
    }
    const order = Array.isArray(data) ? data[0] : data;
    if (!order) {
      return jsonFailure(
        "The order response was incomplete. Retry checkout.",
        502,
        cors,
      );
    }
    return Response.json(order, { headers: cors });
  } catch (error) {
    console.error(
      "create-order failed",
      error instanceof Error ? error.message : "Unknown failure",
    );
    return jsonFailure(
      "Checkout is temporarily unavailable. Please retry.",
      503,
      cors,
    );
  }
}

if (import.meta.main) Deno.serve(handleCreateOrderRequest);
