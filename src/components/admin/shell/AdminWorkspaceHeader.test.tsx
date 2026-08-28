import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AdminWorkspaceHeader } from "./AdminWorkspaceHeader";
import { defaultBooth } from "../../../lib/constants";
import { PlatformI18nProvider } from "../../../lib/i18n/platformI18n";
import { ToastProvider } from "../../ui/ToastProvider";
import type { ShopMembership } from "../../../types/catalog";

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
});

const sampleAccess: ShopMembership = {
  shop_id: "shop-1",
  shop_name: "Test Booth",
  shop_slug: "test-booth",
  shop_active: true,
  role: "owner",
  active: true,
};

function renderHeader(props: Partial<React.ComponentProps<typeof AdminWorkspaceHeader>> = {}) {
  const onOpenGuide = vi.fn();
  const onViewTabChange = vi.fn();
  const onSelectShop = vi.fn();
  const onRequestSignOut = vi.fn();

  const rendered = render(
    <MemoryRouter>
      <PlatformI18nProvider>
        <ToastProvider>
          <AdminWorkspaceHeader
            booth={defaultBooth}
            access={sampleAccess}
            memberships={[sampleAccess]}
            viewTab="orders"
            productsCount={0}
            pendingOrderCount={0}
            canManageCatalog
            canCreateShop
            signOutBusy={false}
            onViewTabChange={onViewTabChange}
            onSelectShop={onSelectShop}
            onRequestSignOut={onRequestSignOut}
            onOpenGuide={onOpenGuide}
            {...props}
          />
        </ToastProvider>
      </PlatformI18nProvider>
    </MemoryRouter>,
  );

  return { ...rendered, onOpenGuide, onViewTabChange, onSelectShop, onRequestSignOut };
}

describe("AdminWorkspaceHeader", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the standard guide button when readiness is complete", () => {
    const { onOpenGuide } = renderHeader({
      readiness: { done: 4, total: 4, isComplete: true },
    });

    const guideBtn = screen.getByRole("button", { name: "Booth guide & playbook" });
    expect(guideBtn).toBeInTheDocument();
    expect(screen.queryByText("4/4")).not.toBeInTheDocument();

    fireEvent.click(guideBtn);
    expect(onOpenGuide).toHaveBeenCalledWith(undefined);
  });

  it("renders the readiness badge when setup is incomplete for managers", () => {
    const { onOpenGuide } = renderHeader({
      readiness: { done: 1, total: 4, isComplete: false },
      canManageCatalog: true,
    });

    const guideBtn = screen.getByRole("button", { name: "Shop setup · 1/4 ready" });
    expect(guideBtn).toBeInTheDocument();
    expect(screen.getByText("1/4")).toBeInTheDocument();

    fireEvent.click(guideBtn);
    expect(onOpenGuide).toHaveBeenCalledWith("checklist");
  });

  it("hides the readiness badge for staff", () => {
    renderHeader({
      readiness: { done: 1, total: 4, isComplete: false },
      canManageCatalog: false,
    });

    expect(screen.queryByText("1/4")).not.toBeInTheDocument();
  });
});
