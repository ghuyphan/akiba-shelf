import { assertEquals } from "jsr:@std/assert@1";

Deno.env.set("PUBLIC_SITE_URL", "https://matsuri.pro");
Deno.env.set("SUPABASE_URL", "https://project.test");
Deno.env.set("SUPABASE_ANON_KEY", "test-anon-key");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
Deno.env.set("PUSH_ENDPOINT_HOSTS", "push.example.test,public.example.test");

const { dnsResolver } = await import("../_shared/pushEndpoint.ts");
const { clientFactory, handlePushSubscriptionRequest } = await import(
  "./index.ts"
);

const shopId = "21000000-0000-4000-8000-000000000001";
const userId = "11000000-0000-4000-8000-000000000001";
const encodeBytes = (value: Uint8Array) =>
  btoa(String.fromCharCode(...value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
const keyPair = (await crypto.subtle.generateKey(
  { name: "ECDH", namedCurve: "P-256" },
  true,
  ["deriveBits"],
)) as CryptoKeyPair;
const p256dh = encodeBytes(
  new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey)),
);
const authSecret = encodeBytes(new Uint8Array(16).fill(1));

function request(
  body: Record<string, unknown>,
  origin = "https://matsuri.pro",
) {
  return new Request("https://project.test/functions/v1/push-subscriptions", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
      Origin: origin,
    },
  });
}

function installClients(
  rpcError: { message: string } | null = null,
  subscriptionCount = 0,
) {
  const calls: Array<{ name: string; params: Record<string, unknown> }> = [];
  const caller = {
    auth: {
      getUser: () =>
        Promise.resolve({
          data: { user: { id: userId } },
          error: null,
        }),
    },
  };
  const admin = {
    rpc: (name: string, params: Record<string, unknown>) => {
      calls.push({ name, params });
      return Promise.resolve({ data: rpcError ? null : true, error: rpcError });
    },
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ count: subscriptionCount, error: null }).then(
            resolve,
          ),
      };
      return query;
    },
  };
  clientFactory.createClient = (_url: string, key: string) =>
    (key === "test-service-role-key" ? admin : caller) as any;
  return calls;
}

Deno.test(
  "push subscription API rejects local and private endpoints",
  async () => {
    dnsResolver.resolve = () => Promise.resolve(["127.0.0.1"]);
    installClients();
    for (const endpoint of [
      "https://localhost/push",
      "https://127.0.0.1/push",
      "https://push.internal/path",
      "https://public.example.test/push",
    ]) {
      const response = await handlePushSubscriptionRequest(
        request({
          action: "register",
          shopId,
          endpoint,
          p256dh,
          auth: authSecret,
        }),
      );
      assertEquals(response.status, 400);
    }
  },
);

Deno.test(
  "push subscription API registers validated public endpoints",
  async () => {
    dnsResolver.resolve = () => Promise.resolve(["203.0.113.10"]);
    const calls = installClients();
    const response = await handlePushSubscriptionRequest(
      request({
        action: "register",
        shopId,
        endpoint: "https://push.example.test/subscription",
        p256dh,
        auth: authSecret,
        userAgent: "test-agent",
      }),
    );
    assertEquals(response.status, 200);
    assertEquals(await response.json(), { outcome: "registered" });
    assertEquals(calls[0]?.name, "register_push_subscription");
    assertEquals(calls[0]?.params.p_user_id, userId);
    assertEquals(calls[0]?.params.p_shop_id, shopId);
  },
);

Deno.test(
  "push subscription API rejects invalid P-256 key material",
  async () => {
    dnsResolver.resolve = () => Promise.resolve(["203.0.113.10"]);
    installClients();
    const invalidPoint = encodeBytes(new Uint8Array(65).fill(1));
    const response = await handlePushSubscriptionRequest(
      request({
        action: "register",
        shopId,
        endpoint: "https://push.example.test/invalid-key",
        p256dh: invalidPoint,
        auth: authSecret,
      }),
    );
    assertEquals(response.status, 400);
  },
);

Deno.test(
  "push subscription API unregisters only the caller endpoint",
  async () => {
    dnsResolver.resolve = () => Promise.resolve(["203.0.113.10"]);
    const calls = installClients();
    const response = await handlePushSubscriptionRequest(
      request({
        action: "unregister",
        shopId,
        endpoint: "https://push.example.test/subscription",
      }),
    );
    assertEquals(response.status, 200);
    assertEquals(await response.json(), {
      outcome: "unregistered",
      unsubscribe: true,
    });
    assertEquals(calls[0]?.name, "unregister_push_subscription");
    assertEquals(calls[0]?.params.p_user_id, userId);
  },
);

Deno.test(
  "push subscription API reports server registration status",
  async () => {
    dnsResolver.resolve = () => Promise.resolve(["203.0.113.10"]);
    installClients(null, 1);
    const response = await handlePushSubscriptionRequest(
      request({
        action: "status",
        shopId,
        endpoint: "https://push.example.test/subscription",
      }),
    );
    assertEquals(response.status, 200);
    assertEquals(await response.json(), { enabled: true });
  },
);

Deno.test(
  "push subscription API maps membership and quota failures",
  async () => {
    dnsResolver.resolve = () => Promise.resolve(["203.0.113.10"]);
    installClients({ message: "Push subscription limit reached" });
    const quota = await handlePushSubscriptionRequest(
      request({
        action: "register",
        shopId,
        endpoint: "https://push.example.test/quota",
        p256dh,
        auth: authSecret,
      }),
    );
    assertEquals(quota.status, 409);

    installClients({ message: "Active shop member access required" });
    const forbidden = await handlePushSubscriptionRequest(
      request({
        action: "register",
        shopId,
        endpoint: "https://push.example.test/member",
        p256dh,
        auth: authSecret,
      }),
    );
    assertEquals(forbidden.status, 403);
  },
);

Deno.test(
  "push subscription API rejects foreign origins and malformed bodies",
  async () => {
    assertEquals(
      (await handlePushSubscriptionRequest(request({}, "https://evil.test")))
        .status,
      403,
    );
    const malformed = new Request(
      "https://project.test/functions/v1/push-subscriptions",
      {
        method: "POST",
        body: "{",
        headers: {
          Authorization: "Bearer test-token",
          "Content-Type": "application/json",
          Origin: "https://matsuri.pro",
        },
      },
    );
    assertEquals((await handlePushSubscriptionRequest(malformed)).status, 400);
  },
);
