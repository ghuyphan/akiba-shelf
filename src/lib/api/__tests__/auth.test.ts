import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ client: null as unknown }));

vi.mock("../shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../shared")>()),
  requireSupabase: () => mocks.client,
}));

vi.mock("../../auth/authUrls", () => ({
  getAppUrl: (path: string) => `https://matsuri.test${path}`,
}));

import {
  acceptShopInvitation,
  clearShopInvitationMetadata,
  getAuthSession,
  requestPasswordReset,
  signInAdmin,
  signInWithGoogle,
  signOutAdmin,
  signUpAdmin,
  updateAdminPassword,
} from "../auth";

function authClient() {
  const auth = {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    getSession: vi.fn(),
    updateUser: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
  };
  const rpc = vi.fn();
  mocks.client = { auth, rpc };
  return { auth, rpc };
}

beforeEach(() => vi.clearAllMocks());

describe("admin authentication API", () => {
  it("forwards CAPTCHA and callback contracts", async () => {
    const { auth } = authClient();
    auth.signInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    auth.signInWithOAuth.mockResolvedValue({ data: { url: "oauth" }, error: null });

    await signInAdmin("owner@example.test", "password", "captcha");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "owner@example.test",
      password: "password",
      options: { captchaToken: "captcha" },
    });

    await expect(
      signUpAdmin("owner@example.test", "password", "signup-token"),
    ).resolves.toEqual({ needsConfirmation: true });
    expect(auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          captchaToken: "signup-token",
          emailRedirectTo: "https://matsuri.test/auth/callback",
        }),
      }),
    );

    await requestPasswordReset("owner@example.test", "reset-token");
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "owner@example.test",
      {
        captchaToken: "reset-token",
        redirectTo:
          "https://matsuri.test/auth/callback?next=set-password",
      },
    );

    await signInWithGoogle();
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "https://matsuri.test/auth/callback" },
    });
  });

  it("covers session, password, sign-out, and invitation metadata operations", async () => {
    const { auth, rpc } = authClient();
    const sessionError = new Error("expired");
    auth.getSession.mockResolvedValue({
      data: { session: null },
      error: sessionError,
    });
    auth.updateUser.mockResolvedValue({ error: null });
    auth.signOut.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({
      data: "11000000-0000-4000-8000-000000000001",
      error: null,
    });

    await expect(getAuthSession()).resolves.toEqual({
      session: null,
      error: sessionError,
    });
    await updateAdminPassword("new-password");
    await clearShopInvitationMetadata();
    await signOutAdmin();
    await expect(
      acceptShopInvitation("invitation-1"),
    ).resolves.toBe("11000000-0000-4000-8000-000000000001");

    expect(auth.updateUser).toHaveBeenNthCalledWith(1, {
      password: "new-password",
    });
    expect(auth.updateUser).toHaveBeenNthCalledWith(2, {
      data: { shop_invitation_id: null },
    });
    expect(rpc).toHaveBeenCalledWith("accept_shop_invitation", {
      p_invitation_id: "invitation-1",
    });
  });

  it("rejects malformed invitation responses", async () => {
    const { rpc } = authClient();
    rpc.mockResolvedValue({ data: "not-a-uuid", error: null });

    await expect(acceptShopInvitation("invitation-1")).rejects.toThrow(
      "Invitation response was invalid.",
    );
  });
});
