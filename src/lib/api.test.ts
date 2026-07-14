import { describe, expect, it, vi } from "vitest";
import { normalizeProduct, inviteShopMember, updateShopInvitation } from "./api";
import { LIMITED_STOCK_THRESHOLD } from "./constants";
import { FunctionsHttpError } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

vi.mock("./supabase", () => {
  const mockInvoke = vi.fn();
  return {
    isSupabaseConfigured: true,
    supabase: {
      functions: {
        invoke: mockInvoke,
      },
    },
  };
});

import { supabase } from "./supabase";

class MockFunctionsHttpError extends FunctionsHttpError {
  context: any;
  constructor(message: string, context: any) {
    super(message);
    this.context = context;
  }
}

describe("product normalization", () => {
  it("uses the shared threshold for limited stock", () => {
    expect(normalizeProduct({ quantity_available: LIMITED_STOCK_THRESHOLD }).stock_status).toBe("limited");
    expect(normalizeProduct({ quantity_available: LIMITED_STOCK_THRESHOLD + 1 }).stock_status).toBe("in_stock");
    expect(normalizeProduct({ quantity_available: 0 }).stock_status).toBe("sold_out");
  });
});

describe("CORS configuration and invitation error handling", () => {
  it("verify_jwt remains true for invite-shop-member in supabase/config.toml", () => {
    const configPath = path.resolve(__dirname, "../../supabase/config.toml");
    const content = fs.readFileSync(configPath, "utf8");
    const match = content.match(/\[functions\.invite-shop-member\][^]*?verify_jwt\s*=\s*(true|false)/);
    expect(match).toBeTruthy();
    expect(match![1]).toBe("true");
  });

  it("displays safe server JSON errors correctly for inviteShopMember", async () => {
    const mockContext = {
      json: async () => ({ error: "Active shop owner access required." }),
    };
    const mockError = new MockFunctionsHttpError("Http Error", mockContext);
    const mockInvoke = supabase!.functions.invoke as any;
    mockInvoke.mockResolvedValueOnce({ data: null, error: mockError });

    await expect(
      inviteShopMember("11000000-0000-4000-8000-000000000001", "test@example.com", "staff")
    ).rejects.toThrow("Active shop owner access required.");
  });

  it("displays safe server JSON errors correctly for updateShopInvitation", async () => {
    const mockContext = {
      json: async () => ({ error: "Invitation is no longer pending." }),
    };
    const mockError = new MockFunctionsHttpError("Http Error", mockContext);
    const mockInvoke = supabase!.functions.invoke as any;
    mockInvoke.mockResolvedValueOnce({ data: null, error: mockError });

    await expect(
      updateShopInvitation("11000000-0000-4000-8000-000000000001", "11000000-0000-4000-8000-000000000002", "revoke")
    ).rejects.toThrow("Invitation is no longer pending.");
  });

  it("uses a safe generic fallback for network/CORS failures in inviteShopMember", async () => {
    const mockInvoke = supabase!.functions.invoke as any;
    mockInvoke.mockResolvedValueOnce({ data: null, error: new Error("Network Error") });

    await expect(
      inviteShopMember("11000000-0000-4000-8000-000000000001", "test@example.com", "staff")
    ).rejects.toThrow("Could not reach the invitation service.");
  });

  it("uses a safe generic fallback for network/CORS failures in updateShopInvitation", async () => {
    const mockInvoke = supabase!.functions.invoke as any;
    mockInvoke.mockResolvedValueOnce({ data: null, error: new Error("Network Error") });

    await expect(
      updateShopInvitation("11000000-0000-4000-8000-000000000001", "11000000-0000-4000-8000-000000000002", "revoke")
    ).rejects.toThrow("Could not reach the invitation service.");
  });
});
