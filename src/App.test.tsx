import { act, cleanup, render, screen } from "@testing-library/react";
import { Outlet } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ configurePwa: vi.fn() }));

vi.mock("./lib/offline/pwa", () => ({ configurePwa: mocks.configurePwa }));
vi.mock("./pages/PlatformLayout", () => ({
  PlatformLayout: () => (
    <div data-testid="platform-layout">
      <Outlet />
    </div>
  ),
}));
vi.mock("./pages/HomePage", () => ({ HomePage: () => <p>Home route</p> }));
vi.mock("./pages/SupportPage", () => ({
  SupportPage: () => <p>Support route</p>,
}));
vi.mock("./pages/DashboardPage", () => ({
  DashboardPage: () => <p>Dashboard route</p>,
}));
vi.mock("./pages/NewShopPage", () => ({
  NewShopPage: () => <p>New shop route</p>,
}));
vi.mock("./pages/AdminPage", () => ({ AdminPage: () => <p>Admin route</p> }));
vi.mock("./pages/CatalogPage", () => ({
  CatalogPage: () => <p>Catalog route</p>,
}));
vi.mock("./pages/GachaPage", () => ({ GachaPage: () => <p>Gacha route</p> }));
vi.mock("./pages/AuthPage", () => ({ AuthPage: () => <p>Auth route</p> }));
vi.mock("./pages/AuthCallbackPage", () => ({
  AuthCallbackPage: () => <p>Auth callback route</p>,
}));
vi.mock("./pages/SetPasswordPage", () => ({
  SetPasswordPage: () => <p>Set password route</p>,
}));
vi.mock("./pages/NotFoundPage", () => ({
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
