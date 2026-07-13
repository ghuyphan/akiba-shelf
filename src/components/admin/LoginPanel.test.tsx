import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../ui/ToastProvider";

vi.mock("../../lib/supabase", () => ({ isSupabaseConfigured: true }));

import { LoginPanel } from "./LoginPanel";

describe("admin login panel", () => {
  afterEach(cleanup);

  it("links directly to account creation and password recovery", () => {
    render(
      <ToastProvider>
        <MemoryRouter>
          <LoginPanel onLogin={vi.fn()} />
        </MemoryRouter>
      </ToastProvider>,
    );

    expect(
      screen.getByRole("link", { name: "Forgot password?" }),
    ).toHaveAttribute("href", "/auth?mode=forgot");
    expect(
      screen.getByRole("link", { name: "Create account" }),
    ).toHaveAttribute("href", "/auth?mode=signup");
  });

  it("preserves useful sanitized authentication errors", async () => {
    const onLogin = vi.fn().mockRejectedValue({ code: "email_not_confirmed" });
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <MemoryRouter>
          <LoginPanel onLogin={onLogin} />
        </MemoryRouter>
      </ToastProvider>,
    );

    await user.type(
      screen.getByLabelText("Email address"),
      "artist@example.com",
    );
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Open admin" }));

    expect(await screen.findByText("Confirm your email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });
});
