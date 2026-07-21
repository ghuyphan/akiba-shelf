import { getAppUrl } from "../auth/authUrls";
import { requireSupabase } from "./shared";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function signInAdmin(email: string, password: string) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signUpAdmin(
  email: string,
  password: string,
): Promise<{ needsConfirmation: boolean }> {
  const { data, error } = await requireSupabase().auth.signUp({
    email,
    password,
    options: { emailRedirectTo: getAppUrl("/auth/callback") },
  });
  if (error) throw error;
  return { needsConfirmation: !data.session };
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await requireSupabase().auth.resetPasswordForEmail(email, {
    redirectTo: getAppUrl("/auth/callback?next=set-password"),
  });
  if (error) throw error;
}

export async function getAuthSession() {
  const { data, error } = await requireSupabase().auth.getSession();
  return { session: data.session, error };
}

export async function updateAdminPassword(password: string): Promise<void> {
  const { error } = await requireSupabase().auth.updateUser({ password });
  if (error) throw error;
}

export async function signInWithGoogle() {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: getAppUrl("/auth/callback") },
  });
  if (error) throw error;
  return data;
}

export async function signOutAdmin() {
  const { error } = await requireSupabase().auth.signOut();
  if (error) throw error;
}

export async function acceptShopInvitation(
  invitationId: string,
): Promise<string> {
  const { data, error } = await requireSupabase().rpc(
    "accept_shop_invitation",
    { p_invitation_id: invitationId },
  );
  if (error || typeof data !== "string" || !uuidPattern.test(data)) {
    throw error ?? new Error("Invitation response was invalid.");
  }
  return data;
}

export async function clearShopInvitationMetadata(): Promise<void> {
  const { error } = await requireSupabase().auth.updateUser({
    data: { shop_invitation_id: null },
  });
  if (error) throw error;
}
