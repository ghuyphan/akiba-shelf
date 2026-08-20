import { act, cleanup, render, screen } from "@testing-library/react";
import { Outlet } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ configurePwa: vi.fn() }));

vi.mock("./lib/offline/pwa", () => ({ configurePwa: mocks.configurePwa }));
vi.mock("./pages/platform/PlatformLayout", () => ({
  PlatformLayout: () => (
    <div data-testid="platform-layout">
      <Outlet />
    </div>
  ),
}));
vi.mock("./pages/platform/HomePage", () => ({ HomePage: () => <p>Home route</p> }));
vi.mock("./pages/platform/SupportPage", () => ({
  SupportPage: () => <p>Support route</p>,
}));
vi.mock("./pages/admin/DashboardPage", () => ({
  DashboardPage: () => <p>Dashboard route</p>,
}));
vi.mock("./pages/admin/NewShopPage", () => ({
  NewShopPage: () => <p>New shop route</p>,
}));
vi.mock("./pages/admin/AdminPage", () => ({ AdminPage: () => <p>Admin route</p> }));
vi.mock("./pages/catalog/CatalogPage", () => ({
  CatalogPage: () => <p>Catalog route</p>,
}));
vi.mock("./pages/catalog/GachaPage", () => ({ GachaPage: () => <p>Gacha route</p> }));
vi.mock("./pages/auth/AuthPage", () => ({ AuthPage: () => <p>Auth route</p> }));
vi.mock("./pages/auth/AuthCallbackPage", () => ({
  AuthCallbackPage: () => <p>Auth callback route</p>,
}));
vi.mock("./pages/auth/SetPasswordPage", () => ({
  SetPasswordPage: () => <p>Set password route</p>,
}));
vi.mock("./pages/platform/NotFoundPage", () => ({
  NotFoundPage: () => <p>Not found route</p>,
}));

describe("App route composition", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/support");
    Object.defineProperty(window, "requestIdleCallback", {
      configurable: true,
      value: (callback: IdleRequestCallback) => {
        callback({ didTimeout: false, timeRemaining: () => 50 });
        return 1;
      },
    });
    Object.defineProperty(window, "cancelIdleCallback", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders platform routes and configures PWA behavior after idle", async () => {
    const { App } = await import("./App");
    render(<App />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(screen.getByText("Support route")).toBeInTheDocument();
    expect(screen.getByTestId("platform-layout")).toBeInTheDocument();
    expect(mocks.configurePwa).toHaveBeenCalledWith("/support");
  });
});
