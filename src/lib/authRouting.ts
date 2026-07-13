import type { ShopMembership } from "../types/catalog";

const INVITATION_KEY = "matsuri-pending-shop-invitation";

export function routeAfterAuthentication(memberships: ShopMembership[]) {
  return memberships.length > 0 ? "/dashboard" : "/dashboard/shops/new";
}

export function storePendingInvitation(invitationId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(invitationId)) return false;
  sessionStorage.setItem(
    INVITATION_KEY,
    JSON.stringify({ invitationId, createdAt: Date.now() }),
  );
  return true;
}

export function getPendingInvitation(): string | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(INVITATION_KEY) ?? "null",
    ) as { invitationId?: string; createdAt?: number } | null;
    if (
      !value?.invitationId ||
      !value.createdAt ||
      Date.now() - value.createdAt > 30 * 60 * 1000
    ) {
      clearPendingInvitation();
      return null;
    }
    return value.invitationId;
  } catch {
    clearPendingInvitation();
    return null;
  }
}

export function clearPendingInvitation() {
  sessionStorage.removeItem(INVITATION_KEY);
}
