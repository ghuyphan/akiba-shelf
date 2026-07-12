import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const roles = new Set(["owner", "admin", "staff"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (request.method !== "POST") return Response.json({ error: "Method not allowed." }, { status: 405, headers: cors });
    const authorization = request.headers.get("Authorization");
    if (!authorization) return Response.json({ error: "Authentication required." }, { status: 401, headers: cors });
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) return Response.json({ error: "Authentication required." }, { status: 401, headers: cors });

    const body = await request.json();
    const shopId = typeof body.shopId === "string" ? body.shopId : "";
    const { data: owner } = await admin.from("shop_members").select("user_id").eq("shop_id", shopId).eq("user_id", user.id).eq("role", "owner").eq("active", true).maybeSingle();
    if (!owner) return Response.json({ error: "Active shop owner access required." }, { status: 403, headers: cors });

    if (body.action === "revoke") {
      const { error } = await admin.from("shop_invitations").update({ status: "revoked" }).eq("id", body.invitationId).eq("shop_id", shopId).eq("status", "pending");
      if (error) throw error;
      return Response.json({ ok: true }, { headers: cors });
    }

    let email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    let role = typeof body.role === "string" ? body.role : "staff";
    let invitationId = typeof body.invitationId === "string" ? body.invitationId : "";
    if (body.action === "resend") {
      const { data: invitation, error } = await admin.from("shop_invitations").select("id,email,role").eq("id", invitationId).eq("shop_id", shopId).eq("status", "pending").single();
      if (error) throw error;
      email = invitation.email; role = invitation.role;
    }
    if (!emailPattern.test(email) || email.length > 320) throw new Error("Enter a valid email address.");
    if (!roles.has(role)) throw new Error("Invalid shop role.");

    const { data: existingUserId, error: findError } = await admin.rpc("find_auth_user_by_email", { p_email: email });
    if (findError) throw findError;

    if (existingUserId) {
      const { error } = await admin.from("shop_members").upsert({ shop_id: shopId, user_id: existingUserId, role, active: true }, { onConflict: "shop_id,user_id" });
      if (error) throw error;
      if (invitationId) await admin.from("shop_invitations").update({ status: "accepted" }).eq("id", invitationId).eq("shop_id", shopId);
      return Response.json({ joined: true }, { headers: cors });
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    if (invitationId) {
      const { error } = await admin.from("shop_invitations").update({ expires_at: expiresAt }).eq("id", invitationId).eq("shop_id", shopId).eq("status", "pending");
      if (error) throw error;
    } else {
      const { data: invitation, error } = await admin.from("shop_invitations").insert({ shop_id: shopId, email, role, invited_by: user.id, expires_at: expiresAt }).select("id").single();
      if (error) throw error;
      invitationId = invitation.id;
    }
    const redirectTo = `${Deno.env.get("PUBLIC_SITE_URL") ?? new URL(request.url).origin}/admin`;
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { shop_invitation_id: invitationId } });
    if (inviteError) throw inviteError;
    if (invited.user) {
      const { error } = await admin.from("shop_members").upsert({ shop_id: shopId, user_id: invited.user.id, role, active: true }, { onConflict: "shop_id,user_id" });
      if (error) throw error;
    }
    return Response.json({ invited: true }, { headers: cors });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invitation failed." }, { status: 400, headers: cors });
  }
});
