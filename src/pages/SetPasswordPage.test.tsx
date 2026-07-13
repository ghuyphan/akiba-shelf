import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../components/ui/ToastProvider";
import {
  clearPasswordFlow,
  clearPendingInvitation,
  storePendingInvitation,
  storePasswordFlow,
} from "../lib/authRouting";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  updateUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: { getSession: auth.getSession, updateUser: auth.updateUser },
    rpc: auth.rpc,
  },
}));
vi.mock("../lib/api", () => ({
  getShopMemberships: vi.fn().mockResolvedValue([]),
}));

import { SetPasswordPage } from "./SetPasswordPage";

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={["/auth/set-password"]}>
        <Routes>
          <Route path="/auth/set-password" element={<SetPasswordPage />} />
          <Route path="/admin" element={<p>Admin reached</p>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

describe("set-password invitation completion", () => {
  beforeEach(() => {
    clearPendingInvitation();
    clearPasswordFlow();
    localStorage.clear();
    auth.getSession
      .mockReset()
      .mockResolvedValue({
        data: { session: { user: { id: "user" } } },
        error: null,
      });
    auth.updateUser.mockReset().mockResolvedValue({ data: {}, error: null });
    auth.rpc.mockReset();
  });

  it("rejects direct navigation without a supported short-lived flow", async () => {
    renderPage();
    expect(
      await screen.findByText("Password link unavailable"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Request another recovery email" }),
    ).toBeInTheDocument();
  });

  it("retries invitation acceptance without changing the password twice", async () => {
    const invitationId = "20000000-0000-4000-8000-000000000001";
    const shopId = "21000000-0000-4000-8000-000000000001";
    storePendingInvitation(invitationId);
    auth.rpc
      .mockResolvedValueOnce({ data: null, error: { message: "temporary" } })
      .mockResolvedValueOnce({ data: shopId, error: null });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Set your password");
    await user.type(screen.getByLabelText("New password"), "password123");
    await user.type(screen.getByLabelText("Confirm password"), "password123");
    await user.click(screen.getByRole("button", { name: "Save password" }));
    await screen.findByText("Finish joining the shop");
    expect(auth.updateUser).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Retry invitation" }));
    expect(await screen.findByText("Admin reached")).toBeInTheDocument();
    expect(auth.updateUser).toHaveBeenCalledTimes(2);
    expect(auth.updateUser.mock.calls[0][0]).toEqual({
      password: "password123",
    });
    expect(auth.updateUser.mock.calls[1][0]).toEqual({
      data: { shop_invitation_id: null },
    });
    expect(auth.rpc).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem("akiba-active-shop")).toBe(shopId);
  });

  it("accepts a recovery flow without requiring invitation state", async () => {
    storePasswordFlow("recovery");
    renderPage();
    expect(await screen.findByText("Set your password")).toBeInTheDocument();
  });
});
