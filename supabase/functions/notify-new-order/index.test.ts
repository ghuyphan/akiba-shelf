import { assertEquals } from "jsr:@std/assert@1";

Deno.env.set("PUBLIC_SITE_URL", "https://matsuri.pro");
Deno.env.set("SUPABASE_URL", "https://project.test");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

const { handleNotifyRequest } = await import("./index.ts");

function request(body: string, origin = "https://matsuri.pro") {
  return new Request("https://project.test/functions/v1/notify-new-order", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json", Origin: origin },
  });
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
    const response = await handleNotifyRequest(
      request("{}", "https://evil.test"),
    );
    assertEquals(response.status, 403);
  },
);

Deno.test("notify validates JSON and order credentials", async () => {
  assertEquals((await handleNotifyRequest(request("{"))).status, 400);
  assertEquals(
    (await handleNotifyRequest(request(JSON.stringify({ orderId: "bad" }))))
      .status,
    400,
  );
});
