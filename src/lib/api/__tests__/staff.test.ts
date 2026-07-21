import fs from "node:fs";
import path from "node:path";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { inviteShopMember, updateShopInvitation } from "../staff";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("../../supabase", () => ({
  isSupabaseConfigured: true,
  supabase: { functions: { invoke: mocks.invoke } },
}));

class MockFunctionsHttpError extends FunctionsHttpError {
  context: any;

  constructor(message: string, context: any) {
    super(message);
    this.context = context;
  }
}

describe("CORS configuration and invitation error handling", () => {
  it("keeps JWT verification enabled for invite-shop-member", () => {
    const configPath = path.resolve(process.cwd(), "supabase/config.toml");
    const content = fs.readFileSync(configPath, "utf8");
    const match = content.match(
      /\[functions\.invite-shop-member\][^]*?verify_jwt\s*=\s*(true|false)/,
    );
    expect(match).toBeTruthy();
    expect(match![1]).toBe("true");
  });

  it("surfaces safe server JSON errors for invitations", async () => {
    const error = new MockFunctionsHttpError("Http Error", {
      json: async () => ({ error: "Active shop owner access required." }),
    });
    mocks.invoke.mockResolvedValueOnce({ data: null, error });

    await expect(
      inviteShopMember(
        "11000000-0000-4000-8000-000000000001",
        "test@example.com",
        "staff",
      ),
    ).rejects.toThrow("Active shop owner access required.");
  });

  it("surfaces safe server JSON errors for invitation updates", async () => {
    const error = new MockFunctionsHttpError("Http Error", {
      json: async () => ({ error: "Invitation is no longer pending." }),
    });
    mocks.invoke.mockResolvedValueOnce({ data: null, error });

    await expect(
      updateShopInvitation(
        "11000000-0000-4000-8000-000000000001",
        "11000000-0000-4000-8000-000000000002",
        "revoke",
      ),
    ).rejects.toThrow("Invitation is no longer pending.");
  });

  it("uses a generic fallback for invitation network failures", async () => {
    mocks.invoke.mockResolvedValueOnce({
      data: null,
      error: new Error("Network Error"),
    });

    await expect(
      inviteShopMember(
        "11000000-0000-4000-8000-000000000001",
        "test@example.com",
        "staff",
      ),
    ).rejects.toThrow("Could not reach the invitation service.");
  });

  it("uses a generic fallback for update network failures", async () => {
    mocks.invoke.mockResolvedValueOnce({
      data: null,
      error: new Error("Network Error"),
    });

    await expect(
      updateShopInvitation(
        "11000000-0000-4000-8000-000000000001",
        "11000000-0000-4000-8000-000000000002",
        "revoke",
      ),
    ).rejects.toThrow("Could not reach the invitation service.");
  });
});
