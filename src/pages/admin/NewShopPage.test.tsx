import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlatformI18nProvider } from "../../lib/i18n/platformI18n";
import { ToastProvider } from "../../components/ui/ToastProvider";

const shops = vi.hoisted(() => ({
  createShop: vi.fn(),
}));

vi.mock("../../lib/api/shops", () => ({
  createShop: shops.createShop,
}));

vi.mock("../../hooks/admin/useAdminSession", () => ({
  useAdminSession: () => ({
    state: { status: "authorized", memberships: [] },
    refresh: vi.fn(),
  }),
}));

import { useLocation } from "react-router";
import { NewShopPage } from "./NewShopPage";

function AdminTarget() {
  const location = useLocation();
  return <p>Admin reached: {location.pathname}{location.search}</p>;
}

function renderNewShop(entries: Parameters<typeof MemoryRouter>[0]["initialEntries"]) {
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={entries!.length - 1}>
      <PlatformI18nProvider>
        <ToastProvider>
          <Routes>
            <Route path="/support" element={<p>Previous support page</p>} />
            <Route path="/dashboard" element={<p>Shops dashboard</p>} />
            <Route path="/admin" element={<AdminTarget />} />
            <Route path="/dashboard/shops/new" element={<NewShopPage />} />
          </Routes>
        </ToastProvider>
      </PlatformI18nProvider>
    </MemoryRouter>,
  );
}

describe("NewShopPage navigation", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("returns to the previous route", async () => {
    const user = userEvent.setup();
    renderNewShop([
      { pathname: "/support", key: "support" },
      { pathname: "/dashboard/shops/new", key: "new-shop" },
    ]);

    await user.click(screen.getByRole("link", { name: "Back" }));

    expect(screen.getByText("Previous support page")).toBeInTheDocument();
  });

  it("falls back to the dashboard when opened directly", async () => {
    const user = userEvent.setup();
    renderNewShop(["/dashboard/shops/new"]);

    await user.click(screen.getByRole("link", { name: "Back" }));

    expect(screen.getByText("Shops dashboard")).toBeInTheDocument();
  });

  it("still navigates after a blocked active-shop write", async () => {
    shops.createShop.mockResolvedValueOnce({
      id: "30000000-0000-4000-8000-000000000001",
    });
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("Storage blocked", "SecurityError");
    });
    const user = userEvent.setup();
    renderNewShop(["/dashboard/shops/new"]);

    await user.type(screen.getByLabelText("Shop name"), "Test shop");
    await user.type(screen.getByLabelText("Storefront URL slug"), "test-shop");
    await user.click(screen.getByRole("button", { name: "Create shop" }));

    expect(
      await screen.findByText("Admin reached: /admin?setup=1"),
    ).toBeInTheDocument();
  });
});
