import { assertEquals } from "jsr:@std/assert@1";

Deno.env.set("PUBLIC_SITE_URL", "https://matsuri.test/akiba-shelf");
const { handleInviteRequest } = await import("./index.ts");

function request(body: string, headers: Record<string, string> = {}) {
  return new Request("https://project.test/functions/v1/invite-shop-member", {
    method: "POST",
    body,
    headers: {
      Authorization: "Bearer test",
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

Deno.test("requires authorization", async () => {
  const response = await handleInviteRequest(
    new Request("https://project.test", { method: "POST", body: "{}" }),
  );
  assertEquals(response.status, 401);
});

Deno.test("rejects malformed JSON cleanly", async () => {
  const response = await handleInviteRequest(request("{"));
  assertEquals(response.status, 400);
  assertEquals(await response.json(), { error: "Invalid request body." });
});

Deno.test(
  "validates shop and invitation UUIDs before database access",
  async () => {
    assertEquals(
      (
        await handleInviteRequest(
          request(JSON.stringify({ action: "invite", shopId: "bad" })),
        )
      ).status,
      400,
    );
    assertEquals(
      (
        await handleInviteRequest(
          request(
            JSON.stringify({
              action: "revoke",
              shopId: "11000000-0000-4000-8000-000000000001",
              invitationId: "bad",
            }),
          ),
        )
      ).status,
      400,
    );
  },
);

Deno.test("rejects unsupported actions and disallowed origins", async () => {
  assertEquals(
    (
      await handleInviteRequest(
        request(
          JSON.stringify({
            action: "resend",
            shopId: "11000000-0000-4000-8000-000000000001",
          }),
        ),
      )
    ).status,
    400,
  );
  assertEquals(
    (
      await handleInviteRequest(
        request(
          JSON.stringify({
            action: "invite",
            shopId: "11000000-0000-4000-8000-000000000001",
          }),
          { Origin: "https://evil.test" },
        ),
      )
    ).status,
    403,
  );
});
