import { createClient } from "npm:@supabase/supabase-js@2";

const siteUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "";
const siteOrigin = (() => { try { return new URL(siteUrl).origin; } catch { return ""; } })();
const cors = { "Access-Control-Allow-Origin": siteOrigin, "Vary": "Origin", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const roles = new Set(["admin", "staff"]);
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

    if (!siteOrigin) return Response.json({ error: "Invitation email is not configured." }, { status: 503, headers: cors });
    if (request.headers.get("Origin") && request.headers.get("Origin") !== siteOrigin) return Response.json({ error: "Origin not allowed." }, { status: 403, headers: cors });
    const body = await request.json();
    const shopId = typeof body.shopId === "string" ? body.shopId : "";
    const { data: owner } = await admin.from("shop_members").select("user_id").eq("shop_id", shopId).eq("user_id", user.id).eq("role", "owner").eq("active", true).maybeSingle();
    if (!owner) return Response.json({ error: "Active shop owner access required." }, { status: 403, headers: cors });

    if (!["invite","revoke"].includes(body.action)) return Response.json({ error: "Unsupported invitation action." }, { status: 400, headers: cors });
    if (body.action === "revoke") {
      const { error } = await admin.from("shop_invitations").update({ status: "revoked" }).eq("id", body.invitationId).eq("shop_id", shopId).eq("status", "pending");
      if (error) throw error;
      return Response.json({ ok: true }, { headers: cors });
    }

    let email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    let role = typeof body.role === "string" ? body.role : "staff";
    let invitationId = "";
    if (!emailPattern.test(email) || email.length > 320) throw new Error("Enter a valid email address.");
    if (!roles.has(role)) throw new Error("Invalid shop role.");

    const { data: existingUserId, error: findError } = await callerClient.rpc("grant_existing_shop_member", { p_shop_id: shopId, p_email: email, p_role: role });
    if (findError) throw findError;

    if (existingUserId) {
      return Response.json({ joined: true }, { headers: cors });
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    {
      const { count } = await admin.from("shop_invitations").select("id",{count:"exact",head:true}).eq("invited_by",user.id).gte("created_at",new Date(Date.now()-60*60*1000).toISOString());
      if ((count ?? 0) >= 20) return Response.json({error:"Too many invitations. Try again later."},{status:429,headers:cors});
      const { data: invitation, error } = await admin.from("shop_invitations").insert({ shop_id: shopId, email, role, invited_by: user.id, expires_at: expiresAt }).select("id").single();
      if (error) throw error;
      invitationId = invitation.id;
    }
    const redirectTo = `${siteUrl.replace(/\/$/,"")}/auth/callback`;
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { shop_invitation_id: invitationId } });
    if (inviteError) throw inviteError;
    return Response.json({ invited: true }, { headers: cors });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "The invitation could not be completed." }, { status: 400, headers: cors });
  }
});
