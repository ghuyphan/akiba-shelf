import { extractEdgeFunctionError, requireSupabase } from "./shared";
import {
  invitationOutcomeSchema,
  shopInvitationListSchema,
  shopInvitationSchema,
  staffAccessListSchema,
  staffAccessSchema,
} from "../schemas";
import type { z } from "zod";

export type StaffRole = "owner" | "admin" | "staff";
export type StaffAccess = z.infer<typeof staffAccessSchema>;
export type ShopInvitation = z.infer<typeof shopInvitationSchema>;

export async function getStaffMembers(shopId: string): Promise<StaffAccess[]> {
  const { data, error } = await requireSupabase().rpc("get_shop_members", {
    p_shop_id: shopId,
  });
  if (error) throw error;
  return staffAccessListSchema.parse(data ?? []);
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
  return staffAccessSchema.parse(data);
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
  return invitationOutcomeSchema.parse(data).outcome;
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
  return shopInvitationListSchema.parse(data ?? []);
}

export async function updateShopInvitation(
  shopId: string,
  invitationId: string,
  action: "revoke",
): Promise<void> {
  const { data, error } = await requireSupabase().functions.invoke(
    "invite-shop-member",
    { body: { action, shopId, invitationId } },
  );
  if (error) await handleFunctionsError(error);
  invitationOutcomeSchema.parse(data);
}
