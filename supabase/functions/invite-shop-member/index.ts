import { createClient as defaultCreateClient } from "npm:@supabase/supabase-js@2.110.2";

export const clientFactory = {
  createClient: defaultCreateClient,
};

const siteUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "";
const siteOrigin = (() => {
  try {
    return new URL(siteUrl).origin;
  } catch {
    return "";
  }
})();
const cors = {
  "Access-Control-Allow-Origin": siteOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const roles = new Set(["admin", "staff"]);
const maxBodyLength = 8 * 1024;
const success = () =>
  Response.json({ outcome: "processed" }, { headers: cors });
const failure = (error: string, status: number) =>
  Response.json({ error }, { status, headers: cors });

async function readBoundedText(request: Request) {
  const declaredLength = request.headers.get("Content-Length");
  if (declaredLength) {
    const bytes = Number(declaredLength);
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > maxBodyLength) {
      return null;
    }
  }
  if (!request.body) return null;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBodyLength) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    return null;
  }
}

async function parseBody(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readBoundedText(request);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function handleInviteRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (request.method !== "POST") return failure("Method not allowed.", 405);
  const authorization = request.headers.get("Authorization");
  if (!authorization) return failure("Authentication required.", 401);
  if (!siteOrigin) return failure("Invitation email is not configured.", 503);
  const origin = request.headers.get("Origin");
  if (origin && origin !== siteOrigin) {
    return failure("Origin not allowed.", 403);
  }

  const body = await parseBody(request);
  if (!body) return failure("Invalid request body.", 400);
  const action = typeof body.action === "string" ? body.action : "";
  const shopId = typeof body.shopId === "string" ? body.shopId : "";
  if (!uuidPattern.test(shopId)) {
    return failure("Invalid shop identifier.", 400);
  }
  if (action !== "invite" && action !== "revoke") {
    return failure("Unsupported invitation action.", 400);
  }
  const invitationId = typeof body.invitationId === "string"
    ? body.invitationId
    : "";
  if (action === "revoke" && !uuidPattern.test(invitationId)) {
    return failure("Invalid invitation identifier.", 400);
  }

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const caller = clientFactory.createClient(
      url,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authorization } },
      },
    );
    const admin = clientFactory.createClient(
      url,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const {
      data: { user },
      error: userError,
    } = await caller.auth.getUser();
    if (userError || !user) return failure("Authentication required.", 401);

    const [{ data: shop }, { data: owner }] = await Promise.all([
      admin
        .from("shops")
        .select("id")
        .eq("id", shopId)
        .eq("active", true)
        .maybeSingle(),
      admin
        .from("shop_members")
        .select("user_id")
        .eq("shop_id", shopId)
        .eq("user_id", user.id)
        .eq("role", "owner")
        .eq("active", true)
        .maybeSingle(),
    ]);
    if (!shop || !owner) {
      return failure("Active shop owner access required.", 403);
    }

    if (action === "revoke") {
      const { data: invitation, error: lookupError } = await admin
        .from("shop_invitations")
        .select("id,status")
        .eq("id", invitationId)
        .eq("shop_id", shopId)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (!invitation) return failure("Invitation not found.", 404);
      if (invitation.status !== "pending") {
        return failure("Invitation is no longer pending.", 409);
      }
      const { data: revoked, error: revokeError } = await admin
        .from("shop_invitations")
        .update({ status: "revoked" })
        .eq("id", invitationId)
        .eq("shop_id", shopId)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (revokeError) throw revokeError;
      if (!revoked) return failure("Invitation is no longer pending.", 409);
      return success();
    }

    const email = typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : "";
    const role = typeof body.role === "string" ? body.role : "";
    if (!emailPattern.test(email) || email.length > 320 || !roles.has(role)) {
      return failure("Invalid invitation details.", 400);
    }
    const { count } = await admin
      .from("shop_invitations")
      .select("id", { count: "exact", head: true })
      .eq("invited_by", user.id)
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    if ((count ?? 0) >= 20) {
      return failure("Too many invitations. Try again later.", 429);
    }

    const { data: resolved, error: resolveError } = await admin.rpc(
      "resolve_invitation_user",
      { p_email: email },
    );
    if (resolveError) throw resolveError;
    const account = Array.isArray(resolved) ? resolved[0] : resolved;
    if (account?.user_id && account.email_confirmed) {
      const { error: processError } = await admin.rpc(
        "process_existing_shop_member",
        {
          p_shop_id: shopId,
          p_user_id: account.user_id,
          p_requested_role: role,
          p_actor_id: user.id,
        },
      );
      if (processError) throw processError;
      return success();
    }

    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data: reservation, error: reservationError } = await admin.rpc(
      "reserve_shop_invitation",
      {
        p_shop_id: shopId,
        p_email: email,
        p_role: role,
        p_actor_id: user.id,
        p_expires_at: expiresAt,
      },
    );
    if (reservationError) throw reservationError;
    const reserved = Array.isArray(reservation) ? reservation[0] : reservation;
    const invitationIdForEmail = reserved?.invitation_id as string | undefined;
    const createdNew = reserved?.created_new === true;
    if (!invitationIdForEmail) throw new Error("Invitation reservation failed");

    const redirectTo = `${siteUrl.replace(/\/$/, "")}/auth/callback`;
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      email,
      { redirectTo, data: { shop_invitation_id: invitationIdForEmail } },
    );
    if (inviteError) {
      if (createdNew) {
        const { data: compensated, error: compensationError } = await admin
          .from("shop_invitations")
          .update({ status: "revoked" })
          .eq("id", invitationIdForEmail)
          .eq("status", "pending")
          .select("id")
          .maybeSingle();
        if (compensationError || !compensated) {
          console.warn("Invitation delivery compensation failed", {
            shopId,
            invitationId: invitationIdForEmail,
          });
        }
      }
      console.error("Auth invitation delivery failed", {
        shopId,
        invitationId: invitationIdForEmail,
      });
      return failure("The invitation could not be completed.", 502);
    }
    return success();
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error &&
          typeof error.message === "string"
      ? error.message
      : "Unknown failure";
    console.error(
      "invite-shop-member failed",
      errorMessage,
    );
    if (errorMessage.includes("Shop team limit reached")) {
      return failure("Shop team limit reached.", 409);
    }
    return failure("The invitation could not be completed.", 400);
  }
}

if (import.meta.main) Deno.serve(handleInviteRequest);
