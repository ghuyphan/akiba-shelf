import { assertEquals } from "jsr:@std/assert@1";

Deno.env.set("PUBLIC_SITE_URL", "https://matsuri.pro");
Deno.env.set("SUPABASE_URL", "https://project.test");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
Deno.env.set("VAPID_PUBLIC_KEY", "test-public-key");
Deno.env.set("VAPID_PRIVATE_KEY", "test-private-key");

const { clientFactory, handleNotifyRequest, pushClient } = await import(
  "./index.ts"
);

const validOrderId = "11000000-0000-4000-8000-000000000001";
const validBody = JSON.stringify({
  orderId: validOrderId,
  recoveryToken: "0123456789abcdef0123456789abcdef",
});

function request(body: string, origin = "https://matsuri.pro") {
  return new Request("https://project.test/functions/v1/notify-new-order", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json", Origin: origin },
  });
}

function queryResult(
  result: unknown,
  onDeleteFilter?: (column: string, value: unknown) => void,
) {
  let deleting = false;
  const chain: any = {
    select: () => chain,
    eq: (column: string, value: unknown) => {
      if (deleting) onDeleteFilter?.(column, value);
      return chain;
    },
    limit: () => chain,
    single: () => chain,
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
  claims = [
    {
      outcome: "claimed",
      lease_token: "31000000-0000-4000-8000-000000000001",
      retry_endpoints: [],
    },
  ],
  subscriptions = [
    {
      endpoint: "https://push.test/1",
      p256dh: "key",
      auth: "auth",
    },
  ],
}: {
  claims?: Array<Record<string, unknown>>;
  subscriptions?: Array<{ endpoint: string; p256dh: string; auth: string }>;
} = {}) {
  const completions: Record<string, unknown>[] = [];
  const deletedFilters: Array<[string, unknown]> = [];
  let claimIndex = 0;
  return {
    completions,
    deletedFilters,
    client: {
      from: (table: string) => {
        if (table === "orders") {
          return queryResult({
            data: {
              id: validOrderId,
              shop_id: "21000000-0000-4000-8000-000000000001",
              order_code: "AK-TEST",
              total_amount: 20000,
              status: "pending",
            },
            error: null,
          });
        }
        if (table === "push_subscriptions") {
          return queryResult(
            { data: subscriptions, error: null },
            (column, value) => deletedFilters.push([column, value]),
          );
        }
        if (table === "booth_settings") {
          return queryResult({
            data: { booth_name: "Matsuri", logo_url: null },
            error: null,
          });
        }
        return queryResult({ data: null, error: null });
      },
      rpc: (name: string, params: Record<string, unknown>) => {
        if (name === "claim_order_notification_delivery") {
          const claim = claims[Math.min(claimIndex, claims.length - 1)];
          claimIndex += 1;
          return Promise.resolve({ data: claim, error: null });
        }
        if (name === "complete_order_notification_delivery") {
          completions.push(params);
          return Promise.resolve({ data: true, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
    },
  };
}

Deno.test(
  "notify preflight exposes only the configured site origin",
  async () => {
    const response = await handleNotifyRequest(
      new Request("https://project.test/functions/v1/notify-new-order", {
        method: "OPTIONS",
        headers: { Origin: "https://matsuri.pro" },
      }),
    );
    assertEquals(response.status, 200);
    assertEquals(
      response.headers.get("Access-Control-Allow-Origin"),
      "https://matsuri.pro",
    );
    assertEquals(
      response.headers.get("Access-Control-Allow-Methods"),
      "POST, OPTIONS",
    );
    assertEquals(response.headers.get("Vary"), "Origin");
  },
);

Deno.test(
  "notify rejects disallowed origins before reading credentials",
  async () => {
    assertEquals(
      (await handleNotifyRequest(request("{}", "https://evil.test"))).status,
      403,
    );
  },
);

Deno.test("notify validates bounded JSON and order credentials", async () => {
  assertEquals((await handleNotifyRequest(request("{"))).status, 400);
  assertEquals(
    (await handleNotifyRequest(request(JSON.stringify({ orderId: "bad" }))))
      .status,
    400,
  );
  assertEquals(
    (await handleNotifyRequest(request(`{"padding":"${"x".repeat(1100)}"}`)))
      .status,
    400,
  );
});

Deno.test(
  "successful delivery completes the retryable notification lease",
  async () => {
    const admin = mockAdmin();
    clientFactory.createClient = () => admin.client as any;
    pushClient.setVapidDetails = () => undefined;
    pushClient.sendNotification = () => Promise.resolve({} as any);

    const response = await handleNotifyRequest(request(validBody));
    assertEquals(response.status, 200);
    assertEquals(await response.json(), { sent: 1 });
    assertEquals(admin.completions, [
      {
        p_order_id: validOrderId,
        p_lease_token: "31000000-0000-4000-8000-000000000001",
        p_delivered: true,
        p_error: null,
        p_failed_endpoints: [],
      },
    ]);
  },
);

Deno.test("failed delivery releases the lease for a later retry", async () => {
  const admin = mockAdmin({
    claims: [
      {
        outcome: "claimed",
        lease_token: "31000000-0000-4000-8000-000000000001",
        retry_endpoints: [],
      },
      {
        outcome: "claimed",
        lease_token: "31000000-0000-4000-8000-000000000002",
        retry_endpoints: ["https://push.test/1"],
      },
    ],
  });
  clientFactory.createClient = () => admin.client as any;
  pushClient.setVapidDetails = () => undefined;
  pushClient.sendNotification = () =>
    Promise.reject(new Error("temporary outage"));

  assertEquals((await handleNotifyRequest(request(validBody))).status, 503);
  assertEquals(admin.completions[0]?.p_delivered, false);
  assertEquals(
    admin.completions[0]?.p_lease_token,
    "31000000-0000-4000-8000-000000000001",
  );

  pushClient.sendNotification = () => Promise.resolve({} as any);
  assertEquals((await handleNotifyRequest(request(validBody))).status, 200);
  assertEquals(admin.completions[1]?.p_delivered, true);
  assertEquals(
    admin.completions[1]?.p_lease_token,
    "31000000-0000-4000-8000-000000000002",
  );
});

Deno.test("partial retries target only subscriptions that failed", async () => {
  const admin = mockAdmin({
    claims: [
      {
        outcome: "claimed",
        lease_token: "31000000-0000-4000-8000-000000000001",
        retry_endpoints: [],
      },
      {
        outcome: "claimed",
        lease_token: "31000000-0000-4000-8000-000000000002",
        retry_endpoints: ["https://push.test/2"],
      },
    ],
    subscriptions: [
      { endpoint: "https://push.test/1", p256dh: "key-1", auth: "auth-1" },
      { endpoint: "https://push.test/2", p256dh: "key-2", auth: "auth-2" },
    ],
  });
  clientFactory.createClient = () => admin.client as any;
  pushClient.setVapidDetails = () => undefined;
  const attempts: string[] = [];
  pushClient.sendNotification = (subscription: { endpoint: string }) => {
    attempts.push(subscription.endpoint);
    return subscription.endpoint.endsWith("/2") && attempts.length === 2
      ? Promise.reject(new Error("temporary outage"))
      : Promise.resolve({} as any);
  };

  assertEquals((await handleNotifyRequest(request(validBody))).status, 503);
  assertEquals(admin.completions[0]?.p_failed_endpoints, [
    "https://push.test/2",
  ]);
  assertEquals((await handleNotifyRequest(request(validBody))).status, 200);
  assertEquals(attempts, [
    "https://push.test/1",
    "https://push.test/2",
    "https://push.test/2",
  ]);
});

Deno.test("expired subscriptions do not keep the order retryable", async () => {
  const admin = mockAdmin();
  clientFactory.createClient = () => admin.client as any;
  pushClient.setVapidDetails = () => undefined;
  pushClient.sendNotification = () =>
    Promise.reject(Object.assign(new Error("gone"), { statusCode: 410 }));

  const response = await handleNotifyRequest(request(validBody));
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { sent: 0 });
  assertEquals(admin.completions[0]?.p_delivered, true);
  assertEquals(admin.completions[0]?.p_failed_endpoints, []);
  assertEquals(admin.deletedFilters, [
    ["shop_id", "21000000-0000-4000-8000-000000000001"],
    ["endpoint", "https://push.test/1"],
  ]);
});

Deno.test("invalid subscriptions are removed without attempting delivery", async () => {
  const admin = mockAdmin({
    subscriptions: [{
      endpoint: "http://push.test/1",
      p256dh: "",
      auth: "auth",
    }],
  });
  clientFactory.createClient = () => admin.client as any;
  let deliveries = 0;
  pushClient.sendNotification = () => {
    deliveries += 1;
    return Promise.resolve({} as any);
  };

  const response = await handleNotifyRequest(request(validBody));
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { sent: 0 });
  assertEquals(deliveries, 0);
  assertEquals(admin.completions[0]?.p_delivered, true);
  assertEquals(admin.deletedFilters, [
    ["shop_id", "21000000-0000-4000-8000-000000000001"],
    ["endpoint", "http://push.test/1"],
  ]);
});

Deno.test("push delivery concurrency is bounded", async () => {
  const admin = mockAdmin({
    subscriptions: Array.from({ length: 20 }, (_, index) => ({
      endpoint: `https://push.test/${index}`,
      p256dh: `key-${index}`,
      auth: `auth-${index}`,
    })),
  });
  clientFactory.createClient = () => admin.client as any;
  let activeDeliveries = 0;
  let maxActiveDeliveries = 0;
  pushClient.sendNotification = async () => {
    activeDeliveries += 1;
    maxActiveDeliveries = Math.max(maxActiveDeliveries, activeDeliveries);
    await new Promise((resolve) => setTimeout(resolve, 5));
    activeDeliveries -= 1;
    return {} as any;
  };

  const response = await handleNotifyRequest(request(validBody));
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { sent: 20 });
  assertEquals(maxActiveDeliveries, 8);
});

Deno.test("notification fan-out is bounded", async () => {
  const admin = mockAdmin({
    subscriptions: Array.from({ length: 101 }, (_, index) => ({
      endpoint: `https://push.test/${index}`,
      p256dh: `key-${index}`,
      auth: `auth-${index}`,
    })),
  });
  clientFactory.createClient = () => admin.client as any;
  let deliveries = 0;
  pushClient.sendNotification = () => {
    deliveries += 1;
    return Promise.resolve({} as any);
  };

  const response = await handleNotifyRequest(request(validBody));
  assertEquals(response.status, 503);
  assertEquals(deliveries, 0);
  assertEquals(admin.completions[0]?.p_delivered, false);
});

Deno.test("delivered notification claims remain deduplicated", async () => {
  const admin = mockAdmin({ claims: [{ outcome: "delivered" }] });
  clientFactory.createClient = () => admin.client as any;
  let deliveries = 0;
  pushClient.sendNotification = () => {
    deliveries += 1;
    return Promise.resolve({} as any);
  };

  const response = await handleNotifyRequest(request(validBody));
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { duplicate: true });
  assertEquals(deliveries, 0);
});
