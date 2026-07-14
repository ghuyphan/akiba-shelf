import type { ShopMembership } from "../types/catalog";

const INVITATION_KEY = "matsuri-pending-shop-invitation";
const PASSWORD_FLOW_KEY = "matsuri-password-flow";
const FLOW_TTL = 30 * 60 * 1000;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PasswordFlow = "invitation" | "recovery";
export type AccountDestination =
  | "signin"
  | "complete_invitation"
  | "dashboard";

export function getAccountDestination(options: {
  authenticated: boolean;
  memberships?: ShopMembership[];
  pendingInvitation?: boolean;
}): AccountDestination {
  if (!options.authenticated) return "signin";
  if (options.pendingInvitation) return "complete_invitation";
  return "dashboard";
}

export function routeAfterAuthentication(memberships: ShopMembership[]) {
  void memberships;
  return "/dashboard";
}

export function storePendingInvitation(invitationId: string) {
  if (!uuidPattern.test(invitationId)) return false;
  sessionStorage.setItem(
    INVITATION_KEY,
    JSON.stringify({ invitationId, createdAt: Date.now() }),
  );
  storePasswordFlow("invitation");
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
      Date.now() - value.createdAt > FLOW_TTL
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

export function storePasswordFlow(flow: PasswordFlow) {
  sessionStorage.setItem(
    PASSWORD_FLOW_KEY,
    JSON.stringify({ flow, createdAt: Date.now() }),
  );
}

export function getPasswordFlow(): PasswordFlow | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(PASSWORD_FLOW_KEY) ?? "null",
    ) as { flow?: PasswordFlow; createdAt?: number } | null;
    if (
      !value?.createdAt ||
      !value.flow ||
      !["invitation", "recovery"].includes(value.flow) ||
      Date.now() - value.createdAt > FLOW_TTL
    ) {
      clearPasswordFlow();
      return null;
    }
    return value.flow;
  } catch {
    clearPasswordFlow();
    return null;
  }
}

export function clearPasswordFlow() {
  sessionStorage.removeItem(PASSWORD_FLOW_KEY);
}
