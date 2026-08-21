import { assert, assertEquals } from "jsr:@std/assert@1";

Deno.env.set("SUPABASE_URL", "https://project.test");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

const {
  clientFactory,
  handleWebhookRequest,
  createPayOsSignatureData,
  verifyPayOsSignature,
  extractOrderCode,
  parseWebhookPayload,
  timingSafeEqual,
} = await import("./index.ts");

const testChecksumKey = "d0107775ba298642277d337f7c469b6a715f5a8947cfca8fa89e47cbbe01ef4e";
const testWebhookSecret = "whsec_customsecret12345";
const testShopId = "11000000-0000-4000-8000-000000000001";
const testShopSlug = "akiba-shelf";

// Helper to create a signed payOS payload for tests
async function createTestPayOsPayload(data: Record<string, unknown>, checksumKey = testChecksumKey) {
  const signatureData = createPayOsSignatureData(data);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(checksumKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(signatureData));
  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return {
    code: "00",
    desc: "success",
    data,
    signature,
  };
}

Deno.test("extractOrderCode extracts various format patterns", () => {
  assertEquals(extractOrderCode("AK-00000001"), "AK-00000001");
  assertEquals(extractOrderCode("AK00000001"), "AK-00000001");
  assertEquals(extractOrderCode("THANHTOAN AK-1A2B3C4D DON HANG"), "AK-1A2B3C4D");
  assertEquals(extractOrderCode("NO CODE HERE"), null);
  assertEquals(extractOrderCode(""), null);
});

Deno.test("timingSafeEqual correctly compares strings", () => {
  assert(timingSafeEqual("hello", "hello"));
  assert(!timingSafeEqual("hello", "world"));
  assert(!timingSafeEqual("hello", "hell"));
});

Deno.test("verifyPayOsSignature validates correct HMAC-SHA256 signatures", async () => {
  const data = {
    amount: 150000,
    description: "AK-00000001",
    orderCode: 12345,
  };
  const payload = await createTestPayOsPayload(data, testChecksumKey);
  const valid = await verifyPayOsSignature(payload.data, testChecksumKey, payload.signature);
  assert(valid);

  const invalid = await verifyPayOsSignature(payload.data, testChecksumKey, "invalid-signature");
  assert(!invalid);
});

Deno.test("parseWebhookPayload parses payOS, SePay, and generic payloads", async () => {
  const payOsPayload = await createTestPayOsPayload({
    amount: 50000,
    description: "AK-00000002",
    orderCode: 999,
    reference: "REF123",
  });
  const parsedPayOs = parseWebhookPayload(payOsPayload);
  assertEquals(parsedPayOs?.provider, "payos");
  assertEquals(parsedPayOs?.amount, 50000);
  assertEquals(parsedPayOs?.orderCode, "AK-00000002");

  const sePayPayload = {
    transferType: "in",
    transferAmount: 120000,
    content: "AK-00000003 payment",
    referenceCode: "MB1234",
    accountNumber: "0123456789",
  };
  const parsedSePay = parseWebhookPayload(sePayPayload);
  assertEquals(parsedSePay?.provider, "sepay");
  assertEquals(parsedSePay?.amount, 120000);
  assertEquals(parsedSePay?.orderCode, "AK-00000003");

  const customPayload = {
    amount: 250000,
    content: "AK00000004 text",
    reference: "CUSTOM999",
  };
  const parsedCustom = parseWebhookPayload(customPayload);
  assertEquals(parsedCustom?.provider, "custom_webhook");
  assertEquals(parsedCustom?.amount, 250000);
  assertEquals(parsedCustom?.orderCode, "AK-00000004");
});

function mockClient({
  shop = { id: testShopId, active: true } as { id: string; active: boolean } | null,
  paymentSettings = {
    auto_confirm_enabled: true,
    webhook_secret: testWebhookSecret,
    payos_checksum_key: testChecksumKey,
  },
  rpcResult = { outcome: "confirmed", order: { id: "order-1", status: "confirmed" } },
  rpcError = null as { message?: string } | null,
} = {}) {
  return {
    from(table: string) {
      return {
        select() {
          return {
            eq(_col: string, _val: string) {
              return {
                async maybeSingle() {
                  if (table === "shops") {
                    return { data: shop && shop.active ? shop : null, error: null };
                  }
                  if (table === "payment_settings") {
                    return { data: paymentSettings, error: null };
                  }
                  return { data: null, error: null };
                },
              };
            },
          };
        },
      };
    },
    async rpc(fn: string, params: Record<string, unknown>) {
      if (fn === "confirm_order_by_webhook") {
        if (rpcError) return { data: null, error: rpcError };
        return { data: rpcResult, error: null };
      }
      return { data: null, error: null };
    },
  };
}

Deno.test("payment webhook handles OPTIONS preflight", async () => {
  const req = new Request("https://project.test/functions/v1/payment-webhook", {
    method: "OPTIONS",
  });
  const res = await handleWebhookRequest(req);
  assertEquals(res.status, 204);
});

Deno.test("payment webhook rejects missing shop slug", async () => {
  const req = new Request("https://project.test/functions/v1/payment-webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: 1000 }),
  });
  const res = await handleWebhookRequest(req);
  assertEquals(res.status, 400);
});

Deno.test("payment webhook rejects inactive shop or disabled auto-confirm", async () => {
  clientFactory.createClient = () => mockClient({ shop: null }) as any;
  const req = new Request(`https://project.test/functions/v1/payment-webhook?shop=${testShopSlug}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: 1000 }),
  });
  const res = await handleWebhookRequest(req);
  assertEquals(res.status, 404);

  clientFactory.createClient = () =>
    mockClient({ paymentSettings: { auto_confirm_enabled: false, webhook_secret: "", payos_checksum_key: "" } }) as any;
  const reqDisabled = new Request(`https://project.test/functions/v1/payment-webhook?shop=${testShopSlug}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: 1000 }),
  });
  const resDisabled = await handleWebhookRequest(reqDisabled);
  assertEquals(resDisabled.status, 403);
});

Deno.test("payment webhook verifies payOS payload and executes confirmation", async () => {
  let capturedRpcParams: Record<string, unknown> | null = null;
  clientFactory.createClient = () => {
    const base = mockClient();
    return {
      ...base,
      async rpc(fn: string, params: Record<string, unknown>) {
        capturedRpcParams = params;
        return { data: { outcome: "confirmed", order: { id: "ord-1", status: "confirmed" } }, error: null };
      },
    } as any;
  };

  const payload = await createTestPayOsPayload({
    amount: 150000,
    description: "AK-00000005 thanh toan",
    orderCode: 12345,
    reference: "TXN123",
  });

  const req = new Request(`https://project.test/functions/v1/payment-webhook?shop=${testShopSlug}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const res = await handleWebhookRequest(req);
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.success, true);
  const params = capturedRpcParams as Record<string, unknown> | null;
  assertEquals(params?.p_order_code, "AK-00000005");
  assertEquals(params?.p_amount, 150000);
  assertEquals(params?.p_provider, "payos");
});

Deno.test("payment webhook rejects invalid payOS signature", async () => {
  clientFactory.createClient = () => mockClient() as any;

  const payload = await createTestPayOsPayload({
    amount: 150000,
    description: "AK-00000005 thanh toan",
    orderCode: 12345,
  });
  payload.signature = "tampered_signature";

  const req = new Request(`https://project.test/functions/v1/payment-webhook?shop=${testShopSlug}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const res = await handleWebhookRequest(req);
  assertEquals(res.status, 401);
});

Deno.test("payment webhook verifies generic webhook secret and confirms order", async () => {
  let capturedRpcParams: Record<string, unknown> | null = null;
  clientFactory.createClient = () => {
    const base = mockClient();
    return {
      ...base,
      async rpc(fn: string, params: Record<string, unknown>) {
        capturedRpcParams = params;
        return { data: { outcome: "confirmed" }, error: null };
      },
    } as any;
  };

  const payload = {
    amount: 300000,
    content: "AK-00000006 transfer",
    reference: "MB9999",
  };

  // Missing secret -> 401
  const reqUnauthorized = new Request(`https://project.test/functions/v1/payment-webhook?shop=${testShopSlug}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const resUnauthorized = await handleWebhookRequest(reqUnauthorized);
  assertEquals(resUnauthorized.status, 401);

  // Valid secret header -> 200
  const reqAuthorized = new Request(`https://project.test/functions/v1/payment-webhook?shop=${testShopSlug}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Secret": testWebhookSecret,
    },
    body: JSON.stringify(payload),
  });
  const resAuthorized = await handleWebhookRequest(reqAuthorized);
  assertEquals(resAuthorized.status, 200);
  const params = capturedRpcParams as Record<string, unknown> | null;
  assertEquals(params?.p_order_code, "AK-00000006");
  assertEquals(params?.p_amount, 300000);
});
