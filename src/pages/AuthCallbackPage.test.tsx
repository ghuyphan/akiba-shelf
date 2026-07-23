import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PlatformI18nProvider } from "../lib/i18n/platformI18n";
import { StrictMode } from "react";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

const api = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  getShopMemberships: vi.fn(),
}));

const authRouting = vi.hoisted(() => ({
  storePasswordFlow: vi.fn(),
  storePendingInvitation: vi.fn(),
  routeAfterAuthentication: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
  supabase: { auth },
  isSupabaseConfigured: true,
}));

vi.mock("../lib/api/auth", () => ({
  getAuthSession: api.getAuthSession,
}));
vi.mock("../lib/api/shops", () => ({
  getShopMemberships: api.getShopMemberships,
}));

vi.mock("../lib/auth/authRouting", () => ({
  storePasswordFlow: authRouting.storePasswordFlow,
  storePendingInvitation: authRouting.storePendingInvitation,
  routeAfterAuthentication: authRouting.routeAfterAuthentication,
}));

import { AuthCallbackPage } from "./AuthCallbackPage";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderPage() {
  return render(
    <PlatformI18nProvider>
      <MemoryRouter initialEntries={["/auth/callback"]}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route
            path="/auth/set-password"
            element={<p>Set Password Reached</p>}
          />
          <Route path="/dashboard" element={<p>Dashboard Reached</p>} />
        </Routes>
      </MemoryRouter>
    </PlatformI18nProvider>,
  );
}

function renderPageInStrictMode() {
  return render(
    <StrictMode>
      <PlatformI18nProvider>
        <MemoryRouter initialEntries={["/auth/callback"]}>
          <Routes>
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route
              path="/auth/set-password"
              element={<p>Set Password Reached</p>}
            />
            <Route path="/dashboard" element={<p>Dashboard Reached</p>} />
          </Routes>
        </MemoryRouter>
      </PlatformI18nProvider>
    </StrictMode>,
  );
}

describe("AuthCallbackPage regression tests", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/auth/callback");
    sessionStorage.clear();
    localStorage.clear();
  });

  beforeEach(() => {
    auth.getSession.mockReset();
    api.getAuthSession.mockReset().mockImplementation(async () => {
      const result = await auth.getSession();
      return { session: result.data.session, error: result.error };
    });
    api.getShopMemberships.mockReset().mockResolvedValue([]);
    authRouting.storePasswordFlow.mockReset();
    authRouting.storePendingInvitation.mockReset().mockReturnValue(true);
    authRouting.routeAfterAuthentication
      .mockReset()
      .mockReturnValue("/dashboard");
  });

  it("remains URL intact until Supabase finishes initialization", async () => {
    // 1. Set the callback URL using the real history.replaceState() before installing the spy
    window.history.replaceState(
      null,
      "",
      "/auth/callback#access_token=fake-access-token&refresh_token=fake-refresh-token&expires_in=3600&token_type=bearer",
    );

    // 2. Spy on window.history.replaceState
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    // 3. Make getSession() return an unresolved deferred promise
    const deferred = createDeferred<any>();
    auth.getSession.mockReturnValue(deferred.promise);

    // 4. Render AuthCallbackPage
    renderPage();

    // 5. Wait until getSession() has been called
    await waitFor(() => {
      expect(auth.getSession).toHaveBeenCalled();
    });

    // 6. Verify callback cleanup has not yet happened
    expect(replaceStateSpy).not.toHaveBeenCalled();
    expect(window.location.hash).toContain("access_token=fake-access-token");

    // 7. Resolve getSession() with a valid session
    deferred.resolve({
      data: {
        session: {
          user: { id: "user-id", user_metadata: {} },
        },
      },
      error: null,
    });

    // 8. Verify cleanup then changes URL
    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalled();
    });
    expect(window.location.hash).toBe("");

    // 9. Verify normal routing continues
    expect(await screen.findByText("Dashboard Reached")).toBeInTheDocument();
  });

  it("processes a successful Google OAuth callback and routes to the dashboard", async () => {
    window.history.replaceState(
      null,
      "",
      "/auth/callback#access_token=fake-access-token&refresh_token=fake-refresh-token&expires_in=3600&token_type=bearer",
    );
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "user-id", user_metadata: {} },
        },
      },
      error: null,
    });

    renderPage();

    expect(await screen.findByText("Dashboard Reached")).toBeInTheDocument();
    expect(auth.getSession).toHaveBeenCalledOnce();
    expect(replaceStateSpy).toHaveBeenCalled();
    expect(api.getShopMemberships).toHaveBeenCalledOnce();
    expect(
      screen.queryByText("Could not finish sign in"),
    ).not.toBeInTheDocument();
  });

  it("displays an error when the session is missing", async () => {
    window.history.replaceState(null, "", "/auth/callback");
    auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    renderPage();

    expect(
      await screen.findByText("Could not finish sign in"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This secure link is invalid or expired. Request a new one.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Back to sign in")).toBeInTheDocument();
    expect(api.getShopMemberships).not.toHaveBeenCalled();

    // Verify expected auth shell structure is rendered
    expect(document.querySelector(".admin-login")).toBeInTheDocument();
    expect(document.querySelector(".admin-access-card")).toBeInTheDocument();
    expect(document.querySelector(".admin-login-panel")).toBeInTheDocument();
    expect(document.querySelector(".admin-login-logo")).toBeInTheDocument();
  });

  it("handles session retrieval error cleanly", async () => {
    window.history.replaceState(
      null,
      "",
      "/auth/callback#access_token=sensitive-token",
    );
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    auth.getSession.mockResolvedValue({
      data: { session: null },
      error: {
        code: "flow_state_expired",
        status: 400,
      },
    });

    renderPage();

    expect(
      await screen.findByText("Could not finish sign in"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This secure link is invalid or expired. Request a new one.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("sensitive-token")).not.toBeInTheDocument();
    expect(api.getShopMemberships).not.toHaveBeenCalled();
    expect(replaceStateSpy).toHaveBeenCalled();
  });

  it("detects and handles OAuth error in the callback URL", async () => {
    window.history.replaceState(
      null,
      "",
      "/auth/callback?error_description=Access%20denied",
    );
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    renderPage();

    expect(
      await screen.findByText("Could not finish sign in"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This secure link is invalid or expired. Request a new one.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Access denied")).not.toBeInTheDocument();
    expect(api.getShopMemberships).not.toHaveBeenCalled();
    expect(replaceStateSpy).toHaveBeenCalled();
    expect(auth.getSession).not.toHaveBeenCalled();
  });

  it("handles password-recovery callback via query params", async () => {
    window.history.replaceState(null, "", "/auth/callback?next=set-password");
    auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "user-id", user_metadata: {} },
        },
      },
      error: null,
    });

    renderPage();

    expect(await screen.findByText("Set Password Reached")).toBeInTheDocument();
    expect(authRouting.storePasswordFlow).toHaveBeenCalledWith("recovery");
    expect(api.getShopMemberships).not.toHaveBeenCalled();
  });

  it("handles password-recovery callback via hash params", async () => {
    window.history.replaceState(null, "", "/auth/callback#type=recovery");
    auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "user-id", user_metadata: {} },
        },
      },
      error: null,
    });

    renderPage();

    expect(await screen.findByText("Set Password Reached")).toBeInTheDocument();
    expect(authRouting.storePasswordFlow).toHaveBeenCalledWith("recovery");
    expect(api.getShopMemberships).not.toHaveBeenCalled();
  });

  it("handles staff invitation callback", async () => {
    window.history.replaceState(null, "", "/auth/callback");
    const uuid = "20000000-0000-4000-8000-000000000001";
    auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-id",
            user_metadata: { shop_invitation_id: uuid },
          },
        },
      },
      error: null,
    });

    renderPage();

    expect(await screen.findByText("Set Password Reached")).toBeInTheDocument();
    expect(authRouting.storePendingInvitation).toHaveBeenCalledWith(uuid);
    expect(api.getShopMemberships).not.toHaveBeenCalled();
  });

  it("handles normal authenticated login routing", async () => {
    window.history.replaceState(null, "", "/auth/callback");
    const mockMemberships = [
      { shop_id: "shop-1", role: "owner" as const, active: true },
    ];
    auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "user-id", user_metadata: {} },
        },
      },
      error: null,
    });
    api.getShopMemberships.mockResolvedValue(mockMemberships);
    authRouting.routeAfterAuthentication.mockReturnValue("/dashboard");

    renderPage();

    expect(await screen.findByText("Dashboard Reached")).toBeInTheDocument();
    expect(api.getShopMemberships).toHaveBeenCalled();
    expect(authRouting.routeAfterAuthentication).toHaveBeenCalledWith(
      mockMemberships,
    );
  });

  it("prevents duplicate execution under StrictMode", async () => {
    window.history.replaceState(null, "", "/auth/callback");
    auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "user-id", user_metadata: {} },
        },
      },
      error: null,
    });

    renderPageInStrictMode();

    expect(await screen.findByText("Dashboard Reached")).toBeInTheDocument();
    expect(auth.getSession).toHaveBeenCalledOnce();
  });
});
