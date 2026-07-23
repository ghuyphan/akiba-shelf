import { assertEquals } from "jsr:@std/assert@1";

Deno.env.set("SUPABASE_URL", "https://project.test");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
Deno.env.set("VAPID_PUBLIC_KEY", "test-public-key");
Deno.env.set("VAPID_PRIVATE_KEY", "test-private-key");
Deno.env.set("NOTIFICATION_WORKER_SECRET", "test-worker-secret");
Deno.env.set("PUSH_ENDPOINT_HOSTS", "push.example.test");

const { dnsResolver } = await import("../_shared/pushEndpoint.ts");
dnsResolver.resolve = () => Promise.resolve(["203.0.113.10"]);
const { clientFactory, handleNotifyRequest, pushClient } = await import(
  "./index.ts"
);

const orderId = "11000000-0000-4000-8000-000000000001";
const shopId = "21000000-0000-4000-8000-000000000001";
const leaseToken = "31000000-0000-4000-8000-000000000001";
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
  body: unknown = { action: "drain", batchSize: 10 },
  secret: string | null = "test-worker-secret",
) {
  return new Request("https://project.test/functions/v1/notify-new-order", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "x-notification-worker-secret": secret } : {}),
    },
  });
}

function query(result: unknown, deletes: Array<[string, unknown]>) {
  let deleting = false;
  const chain: any = {
    select: () => chain,
    eq: (column: string, value: unknown) => {
      if (deleting) deletes.push([column, value]);
      return chain;
    },
    order: () => chain,
    limit: () => chain,
    maybeSingle: () => chain,
    delete: () => {
      deleting = true;
      return chain;
    },
    then: (resolve: (value: unknown) => void) => resolve(result),
  };
  return chain;
}

function mockAdmin({
  batch = [
    {
      order_id: orderId,
      shop_id: shopId,
      lease_token: leaseToken,
      retry_endpoints: [],
      attempt_number: 1,
    },
  ],
  subscriptions = [
    {
      endpoint: "https://push.example.test/1",
      p256dh,
      auth: authSecret,
    },
  ],
  orderStatus = "pending",
}: {
  batch?: Record<string, unknown>[];
  subscriptions?: Array<Record<string, unknown>>;
  orderStatus?: string;
} = {}) {
  const completions: Record<string, unknown>[] = [];
  const deletes: Array<[string, unknown]> = [];
  const rpcCalls: Array<{ name: string; params: Record<string, unknown> }> = [];
  const client = {
    from: (table: string) => {
      if (table === "orders") {
        return query(
          {
            data: {
              id: orderId,
              shop_id: shopId,
              order_code: "AK-TEST",
              total_amount: 20000,
              status: orderStatus,
            },
            error: null,
          },
          deletes,
        );
      }
      if (table === "booth_settings") {
        return query({ data: { logo_url: null }, error: null }, deletes);
      }
      return query({ data: null, error: null }, deletes);
    },
    rpc: (name: string, params: Record<string, unknown>) => {
      rpcCalls.push({ name, params });
      if (name === "claim_order_notification_batch") {
        return Promise.resolve({ data: batch, error: null });
      }
      if (name === "get_active_push_subscriptions") {
        return Promise.resolve({ data: subscriptions, error: null });
      }
      if (name === "touch_push_subscriptions") {
        return Promise.resolve({ data: 1, error: null });
      }
      if (name === "complete_order_notification_delivery") {
        completions.push(params);
        return Promise.resolve({ data: true, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
  };
  return { client, completions, deletes, rpcCalls };
}

Deno.test(
  "notification worker rejects public and malformed requests",
  async () => {
    assertEquals((await handleNotifyRequest(request({}, null))).status, 401);
    assertEquals((await handleNotifyRequest(request({}, "wrong"))).status, 401);
    assertEquals(
      (await handleNotifyRequest(request({ action: "send" }))).status,
      400,
    );
    assertEquals((await handleNotifyRequest(request("{"))).status, 400);
    assertEquals(
      (
        await handleNotifyRequest(
          new Request("https://project.test/functions/v1/notify-new-order"),
        )
      ).status,
      405,
    );
  },
);

Deno.test("worker drains and completes a durable notification", async () => {
  const admin = mockAdmin();
  clientFactory.createClient = () => admin.client as any;
  pushClient.setVapidDetails = () => undefined;
  pushClient.sendNotification = () => Promise.resolve({} as any);

  const response = await handleNotifyRequest(request());
  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    claimed: 1,
    results: [{ outcome: "delivered", sent: 1 }],
  });
  assertEquals(admin.completions[0]?.p_delivered, true);
  assertEquals(admin.completions[0]?.p_sent_count, 1);
});

Deno.test(
  "a shop without valid subscribers is recorded as skipped",
  async () => {
    const admin = mockAdmin({ subscriptions: [] });
    clientFactory.createClient = () => admin.client as any;
    pushClient.setVapidDetails = () => undefined;

    const response = await handleNotifyRequest(request());
    assertEquals((await response.json()).results, [
      { outcome: "skipped", sent: 0 },
    ]);
    assertEquals(admin.completions[0]?.p_error, "no_valid_subscriptions");
  },
);

Deno.test("non-pending orders are terminally skipped", async () => {
  const admin = mockAdmin({ orderStatus: "confirmed" });
  clientFactory.createClient = () => admin.client as any;
  const response = await handleNotifyRequest(request());
  assertEquals((await response.json()).results, [
    { outcome: "skipped", sent: 0 },
  ]);
  assertEquals(admin.completions[0]?.p_error, "order_not_pending");
});

Deno.test("temporary push failures remain queued for retry", async () => {
  const admin = mockAdmin();
  clientFactory.createClient = () => admin.client as any;
  pushClient.setVapidDetails = () => undefined;
  pushClient.sendNotification = () => Promise.reject(new Error("outage"));

  const response = await handleNotifyRequest(request());
  assertEquals((await response.json()).results, [
    {
      outcome: "retry_scheduled",
      sent: 0,
    },
  ]);
  assertEquals(admin.completions[0]?.p_delivered, false);
  assertEquals(admin.completions[0]?.p_error, "push_delivery_failed");
  assertEquals(admin.completions[0]?.p_sent_count, 0);
});

Deno.test(
  "transient DNS failures retry without deleting subscriptions",
  async () => {
    const admin = mockAdmin();
    clientFactory.createClient = () => admin.client as any;
    dnsResolver.resolve = () =>
      Promise.reject(
        Object.assign(new Error("resolver unavailable"), { code: "SERVFAIL" }),
      );

    const response = await handleNotifyRequest(request());
    assertEquals((await response.json()).results, [
      { outcome: "retry_scheduled", sent: 0 },
    ]);
    assertEquals(admin.deletes, []);
    assertEquals(admin.completions[0]?.p_failed_endpoints, [
      "https://push.example.test/1",
    ]);
    dnsResolver.resolve = () => Promise.resolve(["203.0.113.10"]);
  },
);

Deno.test(
  "expired and malformed subscriptions never block healthy devices",
  async () => {
    const admin = mockAdmin({
      subscriptions: [
        { endpoint: "http://localhost/push", p256dh, auth: authSecret },
        {
          endpoint: "https://push.example.test/expired",
          p256dh,
          auth: authSecret,
        },
        {
          endpoint: "https://push.example.test/healthy",
          p256dh,
          auth: authSecret,
        },
      ],
    });
    clientFactory.createClient = () => admin.client as any;
    pushClient.setVapidDetails = () => undefined;
    pushClient.sendNotification = (subscription: { endpoint: string }) =>
      subscription.endpoint.endsWith("/expired")
        ? Promise.reject(Object.assign(new Error("gone"), { statusCode: 410 }))
        : Promise.resolve({} as any);

    const response = await handleNotifyRequest(request());
    assertEquals((await response.json()).results, [
      { outcome: "delivered", sent: 1 },
    ]);
    assertEquals(admin.deletes.length, 4);
  },
);

Deno.test("delivery and drain concurrency stay bounded", async () => {
  const admin = mockAdmin({
    subscriptions: Array.from({ length: 20 }, (_, index) => ({
      endpoint: `https://push.example.test/${index}`,
      p256dh,
      auth: authSecret,
    })),
  });
  clientFactory.createClient = () => admin.client as any;
  pushClient.setVapidDetails = () => undefined;
  let active = 0;
  let maximum = 0;
  pushClient.sendNotification = async () => {
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return {} as any;
  };

  await handleNotifyRequest(request({ action: "drain", batchSize: 1000 }));
  assertEquals(maximum, 8);
  assertEquals(admin.rpcCalls[0], {
    name: "claim_order_notification_batch",
    params: { p_batch_size: 3 },
  });
});
