import { assertEquals } from "jsr:@std/assert@1";

Deno.env.set("PUBLIC_SITE_URL", "https://matsuri.test/akiba-shelf");
Deno.env.set("SUPABASE_URL", "https://project.test");
Deno.env.set("SUPABASE_ANON_KEY", "test-anon-key");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

const { handleInviteRequest, clientFactory } = await import("./index.ts");

let callerMock: any;
let adminMock: any;

clientFactory.createClient = (url: string, key: string, _options?: any) => {
  if (key === "test-service-role-key") {
    return adminMock;
  }
  return callerMock;
};

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

function mockSupabaseClient(responses: {
  user?: any;
  userError?: any;
  shop?: any;
  owner?: any;
  invitationsCount?: number;
  rpcResolve?: any;
  existingInvitation?: any;
  insertedInvitation?: any;
  inviteUserError?: any;
}) {
  const createChain = (resolveValue: any) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      gte: () => chain,
      ilike: () => chain,
      gt: () => chain,
      insert: () => chain,
      single: () => chain,
      maybeSingle: () => chain,
      update: () => chain,
      then: (resolve: any) => resolve(resolveValue),
    };
    return chain;
  };

  return {
    auth: {
      getUser: () => Promise.resolve({ data: { user: responses.user }, error: responses.userError }),
      admin: {
        inviteUserByEmail: () => Promise.resolve({ data: {}, error: responses.inviteUserError || null }),
      },
    },
    from: (table: string) => {
      if (table === "shops") {
        return createChain({ data: responses.shop, error: null });
      }
      if (table === "shop_members") {
        return createChain({ data: responses.owner, error: null });
      }
      if (table === "shop_invitations") {
        let isInsert = false;
        let isCount = false;
        const chain = {
          select: (_columns?: string, options?: any) => {
            if (options && options.count === "exact") {
              isCount = true;
            }
            return chain;
          },
          eq: () => chain,
          gte: () => chain,
          ilike: () => chain,
          gt: () => chain,
          insert: () => {
            isInsert = true;
            return chain;
          },
          single: () => chain,
          maybeSingle: () => chain,
          update: () => chain,
          then: (resolve: any) => {
            if (isCount) {
              resolve({ count: responses.invitationsCount ?? 0, error: null });
            } else if (isInsert) {
              resolve({ data: responses.insertedInvitation ?? { id: "new-invitation-uuid" }, error: null });
            } else {
              resolve({ data: responses.existingInvitation ?? null, error: null });
            }
          },
        };
        return chain;
      }
      return createChain({ data: null, error: null });
    },
    rpc: (name: string, _args?: any) => {
      if (name === "resolve_invitation_user") {
        return Promise.resolve({ data: responses.rpcResolve ?? null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
  } as any;
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

Deno.test("OPTIONS preflight returns correct status and CORS headers without authorization", async () => {
  const response = await handleInviteRequest(
    new Request("https://project.test/functions/v1/invite-shop-member", {
      method: "OPTIONS",
      headers: {
        Origin: "https://matsuri.test",
      },
    }),
  );
  assertEquals(response.status === 200 || response.status === 204, true);
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "https://matsuri.test");
  assertEquals(response.headers.get("Access-Control-Allow-Headers"), "authorization, x-client-info, apikey, content-type");
  assertEquals(response.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
  assertEquals(response.headers.get("Vary"), "Origin");
});

Deno.test("POST with invalid token returns 401", async () => {
  callerMock = mockSupabaseClient({
    user: null,
    userError: { message: "Invalid token" } as any,
  });
  const response = await handleInviteRequest(
    request(JSON.stringify({ action: "invite", shopId: "11000000-0000-4000-8000-000000000001", email: "test@example.com", role: "staff" }))
  );
  assertEquals(response.status, 401);
  assertEquals(await response.json(), { error: "Authentication required." });
});

Deno.test("POST by authenticated non-owner returns 403", async () => {
  callerMock = mockSupabaseClient({
    user: { id: "user-id" },
  });
  adminMock = mockSupabaseClient({
    shop: { id: "11000000-0000-4000-8000-000000000001" },
    owner: null,
  });

  const response = await handleInviteRequest(
    request(JSON.stringify({ action: "invite", shopId: "11000000-0000-4000-8000-000000000001", email: "test@example.com", role: "staff" }))
  );
  assertEquals(response.status, 403);
  assertEquals(await response.json(), { error: "Active shop owner access required." });
});

Deno.test("POST with inactive owner or inactive shop returns 403", async () => {
  callerMock = mockSupabaseClient({
    user: { id: "user-id" },
  });
  adminMock = mockSupabaseClient({
    shop: null,
    owner: { user_id: "user-id" },
  });

  const response = await handleInviteRequest(
    request(JSON.stringify({ action: "invite", shopId: "11000000-0000-4000-8000-000000000001", email: "test@example.com", role: "staff" }))
  );
  assertEquals(response.status, 403);
  assertEquals(await response.json(), { error: "Active shop owner access required." });
});

Deno.test("POST by owner of another shop returns 403", async () => {
  callerMock = mockSupabaseClient({
    user: { id: "owner-of-A" },
  });
  adminMock = mockSupabaseClient({
    shop: { id: "11000000-0000-4000-8000-000000000002" },
    owner: null,
  });

  const response = await handleInviteRequest(
    request(JSON.stringify({ action: "invite", shopId: "11000000-0000-4000-8000-000000000002", email: "test@example.com", role: "staff" }))
  );
  assertEquals(response.status, 403);
  assertEquals(await response.json(), { error: "Active shop owner access required." });
});

Deno.test("Active owner reaches invitation logic and succeeds", async () => {
  callerMock = mockSupabaseClient({
    user: { id: "owner-id" },
  });
  adminMock = mockSupabaseClient({
    shop: { id: "11000000-0000-4000-8000-000000000001" },
    owner: { user_id: "owner-id" },
    invitationsCount: 0,
    rpcResolve: null,
    existingInvitation: null,
    insertedInvitation: { id: "new-invitation-uuid" },
  });

  const response = await handleInviteRequest(
    request(JSON.stringify({ action: "invite", shopId: "11000000-0000-4000-8000-000000000001", email: "test@example.com", role: "staff" }))
  );
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { outcome: "processed" });
});
