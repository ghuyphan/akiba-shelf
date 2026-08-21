import {
  createClient as defaultCreateClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2.110.2";
import {
  jsonFailure,
  readBoundedJson,
  requiredEnv,
  type JsonObject,
} from "../_shared/http.ts";

export const clientFactory = {
  createClient: defaultCreateClient,
};

const maxBodyBytes = 64 * 1024;
const responseHeaders = { "Cache-Control": "no-store", "Content-Type": "application/json" };
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const orderCodeRegex = /\b(?:AK-?)?([0-9A-Fa-f]{8})\b/i;

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function createPayOsSignatureData(data: Record<string, unknown>): string {
  const sortedKeys = Object.keys(data).sort();
  const pairs: string[] = [];
  for (const key of sortedKeys) {
    let value = data[key];
    if (value === undefined || value === null) {
      value = "";
    } else if (typeof value === "object") {
      value = JSON.stringify(value);
    } else {
      value = String(value);
    }
    pairs.push(`${key}=${value}`);
  }
  return pairs.join("&");
}

export async function verifyPayOsSignature(
  data: Record<string, unknown>,
  checksumKey: string,
  expectedSignature: string,
): Promise<boolean> {
  if (!checksumKey || !expectedSignature) return false;
  const signatureData = createPayOsSignatureData(data);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(checksumKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signatureData),
  );
  const computedHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return timingSafeEqual(computedHex.toLowerCase(), expectedSignature.toLowerCase().trim());
}

export function extractOrderCode(text: string): string | null {
  if (!text) return null;
  const match = text.match(orderCodeRegex);
  if (!match) return null;
  const hexPart = match[1].toUpperCase();
  return `AK-${hexPart}`;
}

export type ParsedTransaction = {
  provider: "payos" | "sepay" | "custom_webhook";
  amount: number;
  orderCode: string | null;
  transactionRef: string;
  accountNumber?: string;
  description?: string;
};

export function parseWebhookPayload(body: JsonObject): ParsedTransaction | null {
  // Check payOS format
  if (
    body.data &&
    typeof body.data === "object" &&
    !Array.isArray(body.data) &&
    typeof body.signature === "string"
  ) {
    const data = body.data as Record<string, unknown>;
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const desc = String(data.description ?? "");
    const orderCode = extractOrderCode(desc) || (data.orderCode ? extractOrderCode(String(data.orderCode)) : null);
    const transactionRef = String(data.reference || data.paymentLinkId || data.orderCode || crypto.randomUUID());
    const accountNumber = data.accountNumber ? String(data.accountNumber) : undefined;

    return {
      provider: "payos",
      amount: Math.round(amount),
      orderCode,
      transactionRef,
      accountNumber,
      description: desc,
    };
  }

  // Check SePay format (transferType === "in")
  if ("transferType" in body || "transferAmount" in body) {
    if (body.transferType && body.transferType !== "in") {
      return null;
    }
    const amount = Number(body.transferAmount ?? body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const content = String(body.content ?? body.description ?? body.code ?? "");
    const orderCode = extractOrderCode(content) || (body.code ? extractOrderCode(String(body.code)) : null);
    const transactionRef = String(body.referenceCode || body.id || crypto.randomUUID());
    const accountNumber = body.accountNumber ? String(body.accountNumber) : undefined;

    return {
      provider: "sepay",
      amount: Math.round(amount),
      orderCode,
      transactionRef,
      accountNumber,
      description: content,
    };
  }

  // Generic custom webhook format
  const rawAmount = Number(body.amount ?? body.transferAmount ?? body.total);
  if (Number.isFinite(rawAmount) && rawAmount > 0) {
    const content = String(body.content ?? body.description ?? body.orderCode ?? body.message ?? "");
    const orderCode = extractOrderCode(content) || (body.orderCode ? extractOrderCode(String(body.orderCode)) : null);
    const transactionRef = String(body.reference || body.transactionId || body.id || crypto.randomUUID());
    const accountNumber = body.accountNumber ? String(body.accountNumber) : undefined;

    return {
      provider: "custom_webhook",
      amount: Math.round(rawAmount),
      orderCode,
      transactionRef,
      accountNumber,
      description: content,
    };
  }

  return null;
}

export async function handleWebhookRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-shop-slug",
      },
    });
  }

  if (request.method !== "POST") {
    return jsonFailure("Method not allowed", 405, responseHeaders);
  }

  const url = new URL(request.url);
  const shopSlug = (
    url.searchParams.get("shop") ||
    request.headers.get("x-shop-slug") ||
    ""
  ).trim().toLowerCase();

  if (!shopSlug || !slugPattern.test(shopSlug)) {
    return jsonFailure("Valid shop slug is required via ?shop= query parameter or x-shop-slug header", 400, responseHeaders);
  }

  const body = await readBoundedJson(request, maxBodyBytes);
  if (!body) {
    return jsonFailure("Invalid JSON body or payload exceeds size limit", 400, responseHeaders);
  }

  const env = requiredEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  if (!env) {
    return jsonFailure("Server misconfiguration", 500, responseHeaders);
  }

  const admin = clientFactory.createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as SupabaseClient;

  // Retrieve shop and payment settings
  const { data: shop, error: shopError } = await admin
    .from("shops")
    .select("id,active")
    .eq("slug", shopSlug)
    .maybeSingle();

  if (shopError || !shop || !shop.active) {
    return jsonFailure("Shop not found or inactive", 404, responseHeaders);
  }

  const { data: paymentSettings, error: paymentError } = await admin
    .from("payment_settings")
    .select("auto_confirm_enabled,webhook_secret,payos_checksum_key")
    .eq("shop_id", shop.id)
    .maybeSingle();

  if (paymentError || !paymentSettings) {
    return jsonFailure("Payment settings not found", 404, responseHeaders);
  }

  if (!paymentSettings.auto_confirm_enabled) {
    return jsonFailure("Automated payment confirmation is disabled for this shop", 403, responseHeaders);
  }

  const parsed = parseWebhookPayload(body);
  if (!parsed) {
    return jsonFailure("Unrecognized webhook payload format or invalid transaction amount", 400, responseHeaders);
  }

  // Authentication check:
  if (parsed.provider === "payos") {
    const signature = String(body.signature ?? "");
    const checksumKey = paymentSettings.payos_checksum_key?.trim() || "";
    if (!checksumKey) {
      return jsonFailure("Shop has not configured payos_checksum_key", 403, responseHeaders);
    }
    const isValid = await verifyPayOsSignature(body.data as Record<string, unknown>, checksumKey, signature);
    if (!isValid) {
      return jsonFailure("Invalid payOS webhook signature", 401, responseHeaders);
    }
  } else {
    // Generic or SePay webhook: verify webhook secret
    const configuredSecret = paymentSettings.webhook_secret?.trim();
    if (configuredSecret) {
      const headerSecret = (
        request.headers.get("x-webhook-secret") ||
        request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
        url.searchParams.get("secret") ||
        ""
      ).trim();

      if (!headerSecret || !timingSafeEqual(configuredSecret, headerSecret)) {
        return jsonFailure("Unauthorized webhook secret", 401, responseHeaders);
      }
    }
  }

  // If no order code is found in transaction description, record the unlinked transaction and return 200
  if (!parsed.orderCode) {
    await admin.rpc("confirm_order_by_webhook", {
      p_shop_id: shop.id,
      p_order_code: "UNMATCHED",
      p_amount: parsed.amount,
      p_provider: parsed.provider,
      p_transaction_ref: parsed.transactionRef,
      p_account_number: parsed.accountNumber ?? null,
      p_description: parsed.description ?? null,
      p_raw_payload: body,
    });
    return Response.json(
      {
        success: true,
        outcome: "unmatched_order_code",
        message: "Transaction logged but no order code was matched in the transfer content.",
      },
      { status: 200, headers: responseHeaders },
    );
  }

  // Execute confirmation RPC
  const { data: rpcResult, error: rpcError } = await admin.rpc("confirm_order_by_webhook", {
    p_shop_id: shop.id,
    p_order_code: parsed.orderCode,
    p_amount: parsed.amount,
    p_provider: parsed.provider,
    p_transaction_ref: parsed.transactionRef,
    p_account_number: parsed.accountNumber ?? null,
    p_description: parsed.description ?? null,
    p_raw_payload: body,
  });

  if (rpcError) {
    console.error("confirm_order_by_webhook rpc error:", rpcError);
    return jsonFailure("Failed to process payment confirmation", 500, responseHeaders);
  }

  return Response.json(
    {
      success: true,
      result: rpcResult,
    },
    { status: 200, headers: responseHeaders },
  );
}

if (import.meta.main) {
  Deno.serve((req) => handleWebhookRequest(req));
}
