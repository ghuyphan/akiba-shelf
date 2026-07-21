import { extractEdgeFunctionError, requireSupabase } from "./shared";

export type StaffRole = "owner" | "admin" | "staff";
export type StaffAccess = {
  shop_id?: string;
  user_id?: string;
  email?: string;
  role: StaffRole;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};
export type ShopInvitation = {
  id: string;
  shop_id: string;
  email: string;
  role: StaffRole;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  created_at: string;
};

export async function getStaffMembers(shopId: string): Promise<StaffAccess[]> {
  const { data, error } = await requireSupabase().rpc("get_shop_members", {
    p_shop_id: shopId,
  });
  if (error) throw error;
  return (data ?? []) as StaffAccess[];
}

export async function saveStaffMember(
  shopId: string,
  member: { user_id: string; role: StaffRole; active: boolean },
) {
  const { data, error } = await requireSupabase().rpc("save_shop_member", {
    p_shop_id: shopId,
    p_user_id: member.user_id,
    p_role: member.role,
    p_active: member.active,
  });
  if (error) throw error;
  return data as StaffAccess;
}

export async function deleteStaffMember(shopId: string, userId: string) {
  const { error } = await requireSupabase().rpc("delete_shop_member", {
    p_shop_id: shopId,
    p_user_id: userId,
  });
  if (error) throw error;
}

async function handleFunctionsError(error: unknown): Promise<never> {
  try {
    const message = await extractEdgeFunctionError(error);
    if (message) throw new Error(message);
  } catch (caught) {
    if (
      caught instanceof Error &&
      caught.message !== "Could not reach the invitation service."
    ) {
      throw caught;
    }
  }
  throw new Error("Could not reach the invitation service.");
}

export type InvitationOutcome = "processed";

export async function inviteShopMember(
  shopId: string,
  email: string,
  role: StaffRole,
): Promise<InvitationOutcome> {
  const { data, error } = await requireSupabase().functions.invoke(
    "invite-shop-member",
    { body: { action: "invite", shopId, email, role } },
  );
  if (error) await handleFunctionsError(error);
  if ((data as { outcome?: string })?.outcome !== "processed") {
    throw new Error("Invitation response was invalid.");
  }
  return "processed";
}

export async function getShopInvitations(
  shopId: string,
): Promise<ShopInvitation[]> {
  const { data, error } = await requireSupabase()
    .from("shop_invitations")
    .select("id,shop_id,email,role,status,expires_at,created_at")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ShopInvitation[];
}

export async function updateShopInvitation(
  shopId: string,
  invitationId: string,
  action: "resend" | "revoke",
): Promise<void> {
  const { error } = await requireSupabase().functions.invoke(
    "invite-shop-member",
    { body: { action, shopId, invitationId } },
  );
  if (error) await handleFunctionsError(error);
}
