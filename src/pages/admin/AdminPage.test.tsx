import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/ui/ToastProvider";
import { PlatformI18nProvider } from "../../lib/i18n/platformI18n";
import { defaultBooth, defaultPayment, defaultPromotion } from "../../lib/constants";

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
});

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
vi.mock("../../hooks/admin/useAdminCatalogWorkspace", () => ({
  useAdminCatalogWorkspace: () => ({
    booth: defaultBooth,
    catalogLoading: false,
    loadedShopId: "shop-1",
    markLocalWrite: vi.fn(),
    payment: defaultPayment,
    products: [],
    promotion: defaultPromotion,
    reload: vi.fn().mockResolvedValue(undefined),
    selectedProduct: undefined,
    setBooth: vi.fn(),
    setPayment: vi.fn(),
    setProducts: vi.fn(),
    setPromotion: vi.fn(),
    setSelectedProduct: vi.fn(),
  }),
}));
vi.mock("../../hooks/admin/useAdminOrdersWorkspace", () => ({
  useAdminOrdersWorkspace: () => ({
    changeFilter: vi.fn(),
    changeTodayOnly: vi.fn(),
    eventOrderCount: 0,
    expiringOrderCount: 0,
    openPending: vi.fn(),
    orderCounts: { pending: 0, confirmed: 0, packed: 0, completed: 0, cancelled: 0 },
    orderFilter: "all",
    orderPage: 1,
    orderTotal: 0,
    orders: [],
    ordersLoading: false,
    ordersTodayOnly: false,
    pageSize: 20,
    reload: vi.fn().mockResolvedValue(undefined),
    sales: { total_sales_vnd: 0, total_orders: 0, average_order_value_vnd: 0 },
    scheduleReload: vi.fn(),
    selectEvent: vi.fn(),
    selectedEventId: null,
    setOrderPage: vi.fn(),
  }),
}));
vi.mock("../../hooks/shared/useMediaQuery", () => ({
  useMediaQuery: () => false,
}));
vi.mock("../../lib/branding", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/branding")>();
  return {
    ...actual,
    getAdminBranding: vi.fn(),
    useDocumentBranding: vi.fn(),
  };
});
vi.mock("../../components/admin/shell/AdminUnsavedChanges", () => ({
  AdminUnsavedChangesProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAdminNavigationGuard: () => (fn: () => void) => fn(),
  useAdminUnsavedChanges: () => undefined,
}));
vi.mock("../../components/admin/auth/LoginPanel", () => ({
  AdminAccessCheck: () => <p>Checking admin access</p>,
  LoginPanel: () => <p>Admin login</p>,
  AdminAccessDenied: ({ kind, message }: { kind: string; message?: string }) => (
    <p>{message || `Access denied: ${kind}`}</p>
  ),
}));

import { AdminPage } from "./AdminPage";

function renderAdmin(initialEntries = ["/admin"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
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
  localStorage.clear();
  document.body.removeAttribute("style");
  document.body.removeAttribute("aria-hidden");
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

  it("automatically opens the launch checklist guide when ?setup=1 is provided", async () => {
    mocks.session = {
      status: "authorized",
      access: {
        shop_id: "shop-1",
        shop_name: "Test Shop",
        shop_slug: "test-shop",
        shop_active: true,
        role: "owner",
        active: true,
      },
      memberships: [
        {
          shop_id: "shop-1",
          shop_name: "Test Shop",
          shop_slug: "test-shop",
          shop_active: true,
          role: "owner",
          active: true,
        },
      ],
      userId: "user-1",
    };

    renderAdmin(["/admin?setup=1"]);

    expect(await screen.findByText("Booth Guide & Playbook")).toBeInTheDocument();
    expect(screen.getByText("Launch Checklist")).toBeInTheDocument();
    expect(screen.getByText("Shop readiness progress")).toBeInTheDocument();
  });

  it("displays the readiness indicator in the header when setup is incomplete", async () => {
    localStorage.setItem("matsuri-setup-seen-shop-1", "1");
    mocks.session = {
      status: "authorized",
      access: {
        shop_id: "shop-1",
        shop_name: "Test Shop",
        shop_slug: "test-shop",
        shop_active: true,
        role: "owner",
        active: true,
      },
      memberships: [
        {
          shop_id: "shop-1",
          shop_name: "Test Shop",
          shop_slug: "test-shop",
          shop_active: true,
          role: "owner",
          active: true,
        },
      ],
      userId: "user-1",
    };

    renderAdmin(["/admin"]);

    expect(
      await screen.findByRole("button", { name: "Shop setup · 0/4 ready" }),
    ).toBeInTheDocument();
  });
});
