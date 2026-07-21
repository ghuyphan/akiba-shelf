import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../components/ui/ToastProvider";
import { PlatformI18nProvider } from "../lib/i18n/platformI18n";

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));
const api = vi.hoisted(() => ({
  getShopMemberships: vi.fn(),
  requestPasswordReset: vi.fn(),
  signInAdmin: vi.fn(),
  signInWithGoogle: vi.fn(),
  signUpAdmin: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
  supabase: { auth },
  isSupabaseConfigured: true,
}));
vi.mock("../lib/api", () => ({
  getShopMemberships: api.getShopMemberships,
  requestPasswordReset: api.requestPasswordReset,
  signInAdmin: api.signInAdmin,
  signInWithGoogle: api.signInWithGoogle,
  signUpAdmin: api.signUpAdmin,
}));

import { AuthPage } from "./AuthPage";

function renderPage() {
  return render(
    <PlatformI18nProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={["/auth"]}>
          <AuthPage />
        </MemoryRouter>
      </ToastProvider>
    </PlatformI18nProvider>,
  );
}

function renderSignupPage() {
  return render(
    <PlatformI18nProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={["/auth?mode=signup"]}>
          <AuthPage />
        </MemoryRouter>
      </ToastProvider>
    </PlatformI18nProvider>,
  );
}

function renderForgotPage() {
  return render(
    <PlatformI18nProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={["/auth?mode=forgot"]}>
          <AuthPage />
        </MemoryRouter>
      </ToastProvider>
    </PlatformI18nProvider>,
  );
}

describe("AuthPage credential fields", () => {
  afterEach(cleanup);

  beforeEach(() => {
    auth.signInWithPassword.mockReset();
    auth.signUp.mockReset();
    auth.resetPasswordForEmail.mockReset();
    api.getShopMemberships.mockReset().mockResolvedValue([]);
    api.requestPasswordReset
      .mockReset()
      .mockImplementation(async (email: string) => {
      const result = await auth.resetPasswordForEmail(email, {
        redirectTo: "http://localhost:3000/auth/callback?next=set-password",
      });
      if (result.error) throw result.error;
      });
    api.signInAdmin
      .mockReset()
      .mockImplementation(async (email: string, password: string) => {
      const result = await auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      return result.data;
      });
    api.signInWithGoogle.mockReset();
    api.signUpAdmin
      .mockReset()
      .mockImplementation(async (email: string, password: string) => {
      const result = await auth.signUp({
        email,
        password,
        options: { emailRedirectTo: "http://localhost:3000/auth/callback" },
      });
      if (result.error) throw result.error;
      return { needsConfirmation: !result.data.session };
      });
  });

  it("shows and hides the password with an accessible control", async () => {
    const user = userEvent.setup();
    renderPage();
    const password = screen.getByLabelText("Password");

    expect(password).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Email address")).toHaveAttribute(
      "placeholder",
      "you@example.com",
    );
    expect(password).toHaveAttribute("placeholder", "Enter your password");
    expect(
      screen.getByText("Secure access to your shops and staff workspaces."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("starts Google sign in with the app callback", async () => {
    api.signInWithGoogle.mockResolvedValue({});
    const user = userEvent.setup();
    renderPage();

    await user.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );

    expect(api.signInWithGoogle).toHaveBeenCalledOnce();
  });

  it("keeps the email but clears and hides the password after a failed sign in", async () => {
    auth.signInWithPassword.mockResolvedValue({
      error: new Error("Invalid credentials"),
    });
    const user = userEvent.setup();
    renderPage();
    const email = screen.getByLabelText("Email address");
    const password = screen.getByLabelText("Password");

    await user.type(email, "artist@example.com");
    await user.type(password, "password123");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(password).toHaveValue(""));
    expect(password).toHaveAttribute("type", "password");
    expect(email).toHaveValue("artist@example.com");
  });

  it("keeps the email while clearing password state between auth modes", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(
      screen.getByLabelText("Email address"),
      "artist@example.com",
    );
    await user.type(screen.getByLabelText("Password"), "password123");

    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(screen.getByLabelText("Email address")).toHaveValue(
      "artist@example.com",
    );
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("requires a strong matching confirmation before creating an account", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    const user = userEvent.setup();
    renderSignupPage();

    await user.type(
      screen.getByLabelText("Email address"),
      "artist@example.com",
    );
    await user.type(screen.getByLabelText("Password"), "weakpassword");
    await user.type(screen.getByLabelText("Confirm password"), "weakpassword");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(auth.signUp).not.toHaveBeenCalled();
    expect(
      await screen.findByText("Choose a stronger password"),
    ).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Password"));
    await user.clear(screen.getByLabelText("Confirm password"));
    await user.type(screen.getByLabelText("Password"), "StrongPassword1");
    await user.type(
      screen.getByLabelText("Confirm password"),
      "StrongPassword2",
    );
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(auth.signUp).not.toHaveBeenCalled();
    expect(await screen.findByText("Check your password")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Confirm password"));
    await user.type(
      screen.getByLabelText("Confirm password"),
      "StrongPassword1",
    );
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() =>
      expect(auth.signUp).toHaveBeenCalledWith({
        email: "artist@example.com",
        password: "StrongPassword1",
        options: { emailRedirectTo: expect.stringContaining("/auth/callback") },
      }),
    );
    expect(await screen.findByText("Check your email")).toBeInTheDocument();
    expect(screen.getByText(/artist@example.com/)).toBeInTheDocument();
  });

  it("shows a durable privacy-safe recovery confirmation and resend cooldown", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    renderForgotPage();

    await user.type(
      screen.getByLabelText("Email address"),
      "artist@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: "Send recovery link" }),
    );

    expect(await screen.findByText("Check your email")).toBeInTheDocument();
    expect(
      screen.getByText(/If artist@example.com can be recovered/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send again in 30s" }),
    ).toBeDisabled();
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "artist@example.com",
      expect.objectContaining({
        redirectTo: expect.stringContaining("/auth/callback?next=set-password"),
      }),
    );
  });

  it("shows and hides the confirmation password independently", async () => {
    const user = userEvent.setup();
    renderSignupPage();
    const password = screen.getByLabelText("Password");
    const confirmation = screen.getByLabelText("Confirm password");

    await user.click(
      screen.getByRole("button", { name: "Show confirm password" }),
    );
    expect(confirmation).toHaveAttribute("type", "text");
    expect(password).toHaveAttribute("type", "password");

    await user.click(
      screen.getByRole("button", { name: "Hide confirm password" }),
    );
    expect(confirmation).toHaveAttribute("type", "password");
  });
});
