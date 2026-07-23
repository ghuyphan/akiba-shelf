import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";

Deno.env.set("PUBLIC_SITE_URL", "https://matsuri.pro");
Deno.env.set(
  "CHECKOUT_ALLOWED_ORIGINS",
  "http://localhost:5173,http://127.0.0.1:5173",
);
Deno.env.set("SUPABASE_URL", "https://project.test");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
Deno.env.set("CHECKOUT_RATE_LIMIT_SALT", "test-rate-limit-salt");

const { clientFactory, handleCreateOrderRequest } = await import("./index.ts");

const validBody = {
  shopSlug: "akiba-shelf",
  customerName: "Customer",
  items: [{ product_id: "moon-stand", quantity: 2, reward_quantity: 0 }],
  clientRequestId: "11111111-1111-4111-8111-111111111111",
  recoveryToken: "0123456789abcdef0123456789abcdef",
};

function request(
  body: unknown,
  origin = "https://matsuri.pro",
  userAgent = "checkout-test",
) {
  return new Request("https://project.test/functions/v1/create-order", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      "User-Agent": userAgent,
      "X-Forwarded-For": "203.0.113.7",
    },
  });
}

Deno.test("create order preflight reflects only configured origins", async () => {
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
});

Deno.test("create order rejects foreign origins and malformed requests", async () => {
  const foreign = await handleCreateOrderRequest(
    request(validBody, "https://evil.test"),
  );
  assertEquals(foreign.status, 403);
  assertEquals(foreign.headers.get("Access-Control-Allow-Origin"), null);
  assertEquals((await handleCreateOrderRequest(request("{"))).status, 400);
  assertEquals(
    (await handleCreateOrderRequest(request({ ...validBody, items: [] }))).status,
    400,
  );
});

Deno.test("create order forwards a hashed fingerprint to the private wrapper", async () => {
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
    request(validBody, "https://matsuri.pro", "rotated-agent"),
  );
  assertEquals(rotatedAgentResponse.status, 200);
  assertEquals(calls.length, 2);
  const params = calls[0];
  assertMatch(String(params.p_fingerprint_hash), /^[0-9a-f]{64}$/);
  assertEquals(params.p_shop_slug, "akiba-shelf");
  assertEquals(params.p_client_request_id, validBody.clientRequestId);
  assertEquals(calls[1].p_fingerprint_hash, params.p_fingerprint_hash);
});

Deno.test("create order exposes rate limits without leaking internal errors", async () => {
  clientFactory.createClient = () => ({
    rpc: () =>
      Promise.resolve({
        data: null,
        error: { message: "Too many checkout attempts. Please wait." },
      }),
  });
  const limited = await handleCreateOrderRequest(request(validBody));
  assertEquals(limited.status, 429);
  assertEquals((await limited.json()).error, "Too many checkout attempts. Please wait.");

  clientFactory.createClient = () => ({
    rpc: () =>
      Promise.resolve({ data: null, error: { message: "sensitive database detail" } }),
  });
  const hidden = await handleCreateOrderRequest(request(validBody));
  assertEquals(hidden.status, 409);
  assertEquals(
    (await hidden.json()).error,
    "The order could not be created. Review the cart and try again.",
  );
});
