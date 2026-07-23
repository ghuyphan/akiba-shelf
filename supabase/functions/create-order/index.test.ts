import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";

Deno.env.set("PUBLIC_SITE_URL", "https://matsuri.pro");
Deno.env.set(
  "CHECKOUT_ALLOWED_ORIGINS",
  "http://localhost:5173,http://127.0.0.1:5173",
);
Deno.env.set("SUPABASE_URL", "https://project.test");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
Deno.env.set("CHECKOUT_RATE_LIMIT_SALT", "test-rate-limit-salt");
Deno.env.set("TURNSTILE_SECRET", "test-turnstile-secret");

const { clientFactory, handleCreateOrderRequest, turnstileVerifier } =
  await import("./index.ts");

const allowTurnstile = () =>
  Promise.resolve({ success: true, action: "turnstile-spin-v2" });
turnstileVerifier.verify = allowTurnstile;

const validBody = {
  shopSlug: "akiba-shelf",
  customerName: "Customer",
  items: [{ product_id: "moon-stand", quantity: 2, reward_quantity: 0 }],
  clientRequestId: "11111111-1111-4111-8111-111111111111",
  deviceId: "22222222-2222-4222-8222-222222222222",
  recoveryToken: "0123456789abcdef0123456789abcdef",
  turnstileToken: "test-turnstile-token",
};

function request(
  body: unknown,
  origin = "https://matsuri.pro",
  userAgent = "checkout-test",
  proxyHeaders: Record<string, string> = {},
) {
  return new Request("https://project.test/functions/v1/create-order", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      "User-Agent": userAgent,
      "X-Forwarded-For": "203.0.113.7",
      ...proxyHeaders,
    },
  });
}

Deno.test(
  "create order preflight reflects only configured origins",
  async () => {
    const production = await handleCreateOrderRequest(
      new Request("https://project.test/functions/v1/create-order", {
        method: "OPTIONS",
        headers: { Origin: "https://matsuri.pro" },
      }),
    );
    assertEquals(production.status, 200);
    assertEquals(
      production.headers.get("Access-Control-Allow-Origin"),
      "https://matsuri.pro",
    );

    const local = await handleCreateOrderRequest(
      new Request("https://project.test/functions/v1/create-order", {
        method: "OPTIONS",
        headers: { Origin: "http://localhost:5173" },
      }),
    );
    assertEquals(local.status, 200);
    assertEquals(
      local.headers.get("Access-Control-Allow-Origin"),
      "http://localhost:5173",
    );
  },
);

Deno.test(
  "create order rejects foreign origins and malformed requests",
  async () => {
    const foreign = await handleCreateOrderRequest(
      request(validBody, "https://evil.test"),
    );
    assertEquals(foreign.status, 403);
    assertEquals(foreign.headers.get("Access-Control-Allow-Origin"), null);
    assertEquals((await handleCreateOrderRequest(request("{"))).status, 400);
    assertEquals(
      (await handleCreateOrderRequest(request({ ...validBody, items: [] })))
        .status,
      400,
    );
    assertEquals(
      (
        await handleCreateOrderRequest(
          request({ ...validBody, deviceId: "bad" }),
        )
      ).status,
      400,
    );
    assertEquals(
      (
        await handleCreateOrderRequest(
          request({ ...validBody, turnstileToken: "" }),
        )
      ).status,
      400,
    );
  },
);

Deno.test("create order rejects failed or unavailable security checks", async () => {
  let rpcCalls = 0;
  clientFactory.createClient = () => ({
    rpc: () => {
      rpcCalls += 1;
      return Promise.resolve({ data: [], error: null });
    },
  });

  turnstileVerifier.verify = () => Promise.resolve({ success: false });
  const rejected = await handleCreateOrderRequest(request(validBody));
  assertEquals(rejected.status, 403);

  turnstileVerifier.verify = () =>
    Promise.resolve({ success: true, action: "unexpected-action" });
  const wrongAction = await handleCreateOrderRequest(request(validBody));
  assertEquals(wrongAction.status, 403);

  turnstileVerifier.verify = () =>
    Promise.resolve({ success: false, unavailable: true });
  const unavailable = await handleCreateOrderRequest(request(validBody));
  assertEquals(unavailable.status, 503);
  assertEquals(rpcCalls, 0);
  turnstileVerifier.verify = allowTurnstile;
});

Deno.test("create order accepts a missing token only during optional rollout", async () => {
  let rpcCalls = 0;
  clientFactory.createClient = () => ({
    rpc: () => {
      rpcCalls += 1;
      return Promise.resolve({
        data: [{ id: "40000000-0000-4000-8000-000000000001" }],
        error: null,
      });
    },
  });
  Deno.env.set("TURNSTILE_ENFORCEMENT", "optional");
  try {
    const response = await handleCreateOrderRequest(
      request({ ...validBody, turnstileToken: "" }),
    );
    assertEquals(response.status, 200);
    assertEquals(rpcCalls, 1);
  } finally {
    Deno.env.delete("TURNSTILE_ENFORCEMENT");
  }
});

Deno.test("create order derives layered checkout identities", async () => {
  const calls: Record<string, unknown>[] = [];
  clientFactory.createClient = () => ({
    rpc: (_name: string, params: Record<string, unknown>) => {
      calls.push(params);
      return Promise.resolve({
        data: [{ id: "40000000-0000-4000-8000-000000000001" }],
        error: null,
      });
    },
  });

  const response = await handleCreateOrderRequest(request(validBody));
  assertEquals(response.status, 200);
  const rotatedAgentResponse = await handleCreateOrderRequest(
    request(validBody, "https://matsuri.pro", "rotated-agent", {
      "X-Forwarded-For": "198.51.100.99",
      "X-Real-IP": "192.0.2.40",
      "CF-Connecting-IP": "203.0.113.200",
    }),
  );
  assertEquals(rotatedAgentResponse.status, 200);
  const legacyResponse = await handleCreateOrderRequest(
    request(
      { ...validBody, deviceId: undefined },
      "https://matsuri.pro",
      "legacy-agent",
      { "X-Forwarded-For": "" },
    ),
  );
  assertEquals(legacyResponse.status, 200);
  assertEquals(calls.length, 3);
  const params = calls[0];
  assertMatch(String(params.p_fingerprint_hash), /^[0-9a-f]{64}$/);
  assertMatch(String(params.p_device_hash), /^[0-9a-f]{64}$/);
  assertMatch(String(params.p_ip_hash), /^[0-9a-f]{64}$/);
  assertEquals(params.p_shop_slug, "akiba-shelf");
  assertEquals(params.p_client_request_id, validBody.clientRequestId);
  assertEquals(calls[1].p_fingerprint_hash, params.p_fingerprint_hash);
  assertEquals(calls[1].p_device_hash, params.p_device_hash);
  assert(calls[1].p_ip_hash !== params.p_ip_hash);
  assertMatch(String(calls[2].p_device_hash), /^[0-9a-f]{64}$/);
  assert(calls[2].p_device_hash !== params.p_device_hash);
  assertEquals(calls[2].p_ip_hash, null);
});

Deno.test(
  "create order exposes rate limits without leaking internal errors",
  async () => {
    clientFactory.createClient = () => ({
      rpc: () =>
        Promise.resolve({
          data: null,
          error: { message: "Too many checkout attempts. Please wait." },
        }),
    });
    const nearMatch = await handleCreateOrderRequest(request(validBody));
    assertEquals(nearMatch.status, 409);
    assertEquals(
      (await nearMatch.json()).error,
      "The order could not be created. Review the cart and try again.",
    );

    clientFactory.createClient = () => ({
      rpc: () =>
        Promise.resolve({
          data: null,
          error: {
            message:
              "Too many checkout attempts. Please wait a few minutes and try again.",
          },
        }),
    });
    const exactLimited = await handleCreateOrderRequest(request(validBody));
    assertEquals(exactLimited.status, 429);
    assertEquals(
      (await exactLimited.json()).error,
      "Too many checkout attempts. Please wait a few minutes and try again.",
    );

    clientFactory.createClient = () => ({
      rpc: () =>
        Promise.resolve({
          data: null,
          error: { message: "sensitive database detail" },
        }),
    });
    const hidden = await handleCreateOrderRequest(request(validBody));
    assertEquals(hidden.status, 409);
    assertEquals(
      (await hidden.json()).error,
      "The order could not be created. Review the cart and try again.",
    );

    clientFactory.createClient = () => ({
      rpc: () =>
        Promise.resolve({
          data: null,
          error: { message: "relation public.promotions does not exist" },
        }),
    });
    const promotionLeak = await handleCreateOrderRequest(request(validBody));
    assertEquals(promotionLeak.status, 409);
    assertEquals(
      (await promotionLeak.json()).error,
      "The order could not be created. Review the cart and try again.",
    );
  },
);
