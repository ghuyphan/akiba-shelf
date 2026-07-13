import { createClient } from "npm:@supabase/supabase-js@2";

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
  Vary: "Origin",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const roles = new Set(["admin", "staff"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type InviteOutcome =
  | "membership_granted"
  | "invitation_sent"
  | "already_member"
  | "already_owner";
const respond = (outcome: InviteOutcome) =>
  Response.json({ outcome }, { headers: cors });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: cors });
  try {
    if (request.method !== "POST")
      return Response.json(
        { error: "Method not allowed." },
        { status: 405, headers: cors },
      );
    const authorization = request.headers.get("Authorization");
    if (!authorization)
      return Response.json(
        { error: "Authentication required." },
        { status: 401, headers: cors },
      );
    if (!siteOrigin)
      return Response.json(
        { error: "Invitation email is not configured." },
        { status: 503, headers: cors },
      );
    if (
      request.headers.get("Origin") &&
      request.headers.get("Origin") !== siteOrigin
    )
      return Response.json(
        { error: "Origin not allowed." },
        { status: 403, headers: cors },
      );

    const url = Deno.env.get("SUPABASE_URL")!;
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
    });
    const admin = createClient(
      url,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const {
      data: { user },
      error: userError,
    } = await caller.auth.getUser();
    if (userError || !user)
      return Response.json(
        { error: "Authentication required." },
        { status: 401, headers: cors },
      );

    const body = await request.json();
    const shopId = typeof body.shopId === "string" ? body.shopId : "";
    const { data: owner } = await admin
      .from("shop_members")
      .select("user_id")
      .eq("shop_id", shopId)
      .eq("user_id", user.id)
      .eq("role", "owner")
      .eq("active", true)
      .maybeSingle();
    if (!owner)
      return Response.json(
        { error: "Active shop owner access required." },
        { status: 403, headers: cors },
      );

    if (body.action === "revoke") {
      const { error } = await admin
        .from("shop_invitations")
        .update({ status: "revoked" })
        .eq("id", body.invitationId)
        .eq("shop_id", shopId)
        .eq("status", "pending");
      if (error) throw error;
      return Response.json({ ok: true }, { headers: cors });
    }
    if (body.action !== "invite")
      return Response.json(
        { error: "Unsupported invitation action." },
        { status: 400, headers: cors },
      );

    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = typeof body.role === "string" ? body.role : "staff";
    if (!emailPattern.test(email) || email.length > 320 || !roles.has(role))
      return Response.json(
        { error: "Invalid invitation details." },
        { status: 400, headers: cors },
      );

    const { count } = await admin
      .from("shop_invitations")
      .select("id", { count: "exact", head: true })
      .eq("invited_by", user.id)
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    if ((count ?? 0) >= 20)
      return Response.json(
        { error: "Too many invitations. Try again later." },
        { status: 429, headers: cors },
      );

    const { data: resolved, error: resolveError } = await admin.rpc(
      "resolve_invitation_user",
      { p_email: email },
    );
    if (resolveError) throw resolveError;
    const account = Array.isArray(resolved) ? resolved[0] : resolved;
    if (account?.user_id && account.email_confirmed) {
      const { data: member, error: memberError } = await admin
        .from("shop_members")
        .select("role,active")
        .eq("shop_id", shopId)
        .eq("user_id", account.user_id)
        .maybeSingle();
      if (memberError) throw memberError;
      if (member?.role === "owner") return respond("already_owner");
      if (member?.active) return respond("already_member");
      const { error } = await admin
        .from("shop_members")
        .upsert(
          { shop_id: shopId, user_id: account.user_id, role, active: true },
          { onConflict: "shop_id,user_id" },
        );
      if (error) throw error;
      return respond("membership_granted");
    }

    await admin
      .from("shop_invitations")
      .update({ status: "revoked" })
      .eq("shop_id", shopId)
      .ilike("email", email)
      .eq("status", "pending");
    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data: invitation, error: insertError } = await admin
      .from("shop_invitations")
      .insert({
        shop_id: shopId,
        email,
        role,
        invited_by: user.id,
        expires_at: expiresAt,
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    const redirectTo = `${siteUrl.replace(/\/$/, "")}/auth/callback`;
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      email,
      { redirectTo, data: { shop_invitation_id: invitation.id } },
    );
    if (inviteError) {
      await admin
        .from("shop_invitations")
        .update({ status: "revoked" })
        .eq("id", invitation.id)
        .eq("status", "pending");
      console.error("Auth invitation delivery failed", {
        shopId,
        invitationId: invitation.id,
        message: inviteError.message,
      });
      throw new Error("Invitation delivery failed");
    }
    return respond("invitation_sent");
  } catch (error) {
    console.error(
      "invite-shop-member failed",
      error instanceof Error ? error.message : error,
    );
    return Response.json(
      { error: "The invitation could not be completed." },
      { status: 400, headers: cors },
    );
  }
});
