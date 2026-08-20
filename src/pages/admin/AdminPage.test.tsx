import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/ui/ToastProvider";
import { PlatformI18nProvider } from "../../lib/i18n/platformI18n";

const mocks = vi.hoisted(() => ({
  session: { status: "checking" } as Record<string, unknown>,
  refresh: vi.fn(),
  selectShop: vi.fn(),
}));

vi.mock("../../hooks/admin/useAdminSession", () => ({
  useAdminSession: () => ({
    state: mocks.session,
    refresh: mocks.refresh,
    selectShop: mocks.selectShop,
  }),
}));
vi.mock("../../hooks/admin/useAdminEventAccess", () => ({
  useAdminEventAccess: () => ({
    state: { status: "unlocked" },
    unlock: vi.fn(),
    verify: vi.fn(),
  }),
}));
vi.mock("../../hooks/admin/useAdminNotifications", () => ({
  useAdminNotifications: () => ({ statuses: [], retry: vi.fn() }),
}));
vi.mock("../../hooks/admin/useAdminOrderRealtime", () => ({
  useAdminOrderRealtime: () => vi.fn(),
}));
vi.mock("../../hooks/admin/useAdminViewRoute", () => ({
  useAdminViewRoute: () => ({ viewTab: "orders", setViewTab: vi.fn() }),
}));
vi.mock("../../hooks/shared/useMediaQuery", () => ({
  useMediaQuery: () => false,
}));
vi.mock("../../lib/branding", () => ({
  getAdminBranding: vi.fn(),
  useDocumentBranding: vi.fn(),
}));
vi.mock("../../components/admin/auth/LoginPanel", () => ({
  AdminAccessCheck: () => <p>Checking admin access</p>,
  LoginPanel: () => <p>Admin login</p>,
  AdminAccessDenied: ({ kind, message }: { kind: string; message?: string }) => (
    <p>{message || `Access denied: ${kind}`}</p>
  ),
}));

import { AdminPage } from "./AdminPage";

function renderAdmin() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <PlatformI18nProvider>
        <ToastProvider>
          <Routes>
            <Route path="/dashboard" element={<p>Dashboard reached</p>} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </ToastProvider>
      </PlatformI18nProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AdminPage access orchestration", () => {
  it("shows the access check while the session is resolving", () => {
    mocks.session = { status: "checking" };
    renderAdmin();
    expect(screen.getByText("Checking admin access")).toBeInTheDocument();
  });

  it("shows login for signed-out staff", () => {
    mocks.session = { status: "unauthenticated" };
    renderAdmin();
    expect(screen.getByText("Admin login")).toBeInTheDocument();
  });

  it("redirects users without a shop membership", () => {
    mocks.session = { status: "unauthorized" };
    renderAdmin();
    expect(screen.getByText("Dashboard reached")).toBeInTheDocument();
  });

  it("keeps session failures visible with their safe message", () => {
    mocks.session = {
      status: "error",
      message: "Could not verify shop access.",
    };
    renderAdmin();
    expect(
      screen.getByText("Could not verify shop access."),
    ).toBeInTheDocument();
  });
});
