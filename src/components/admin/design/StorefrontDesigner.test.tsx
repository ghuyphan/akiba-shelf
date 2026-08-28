import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { defaultBooth, defaultPayment } from "../../../lib/constants";
import { PlatformI18nProvider } from "../../../lib/i18n/platformI18n";
import type { BoothSettings } from "../../../types/catalog";
import { ToastProvider } from "../../ui/ToastProvider";
import { StorefrontDesigner } from "./StorefrontDesigner";

vi.mock("../../catalog/shell/CatalogHeader", () => ({
  CatalogHeader: () => null,
}));
vi.mock("../../catalog/browsing/CategoryFilters", () => ({
  CategoryFilters: () => null,
}));
vi.mock("../../catalog/browsing/CatalogToolbar", () => ({
  CatalogToolbar: () => null,
}));
vi.mock("../../catalog/browsing/ProductGrid", () => ({
  ProductGrid: () => null,
}));
vi.mock("../../catalog/browsing/StackedFeatured", () => ({
  StackedFeatured: () => null,
}));
vi.mock("../../catalog/shell/BoothInfoPanel", () => ({
  BoothInfoPanel: () => null,
}));
vi.mock("../../catalog/cart/SelectedItemPanel", () => ({
  SelectedItemPanel: () => null,
}));

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
});

afterEach(cleanup);

function renderDesigner(shopId: string, settings: BoothSettings) {
  return (
    <PlatformI18nProvider>
      <ToastProvider>
        <StorefrontDesigner
          shopId={shopId}
          settings={settings}
          products={[]}
          payment={defaultPayment}
          onSave={vi.fn().mockResolvedValue(undefined)}
          onSavePayment={vi.fn().mockResolvedValue(undefined)}
        />
      </ToastProvider>
    </PlatformI18nProvider>
  );
}

function Harness() {
  const [booth, setBooth] = useState<BoothSettings>(defaultBooth);
  return (
    <StorefrontDesigner
      shopId="shop-1"
      settings={booth}
      products={[]}
      payment={defaultPayment}
      onSave={async (next) => setBooth(next)}
      onSavePayment={vi.fn().mockRejectedValue(new Error("Payment failed"))}
    />
  );
}

describe("StorefrontDesigner", () => {
  it("uses the shared admin surface for the builder workspace", () => {
    const { container } = render(renderDesigner("shop-1", defaultBooth));

    expect(container.querySelector(".storefront-builder")).toHaveClass(
      "admin-surface",
    );
  });

  it("offers an explicit accessible shade for an unsafe primary", async () => {
    const user = userEvent.setup();
    render(renderDesigner("shop-1", defaultBooth));

    await user.click(screen.getByRole("tab", { name: "Style" }));
    await user.click(
      screen.getByRole("button", {
        name: `Primary: ${defaultBooth.theme_primary}`,
      }),
    );

    expect(
      screen.getByText("Recommended accessible shade"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Use #[0-9a-f]{6}/i }),
    ).toBeInTheDocument();
  });

  it("allows selecting card personality and section card styles in the Style tab", async () => {
    const user = userEvent.setup();
    render(renderDesigner("shop-1", defaultBooth));

    await user.click(screen.getByRole("tab", { name: "Style" }));

    // Global card personality
    const playfulCardBtn = screen.getByRole("button", {
      name: "Playful: Colorful offset shadow",
    });
    await user.click(playfulCardBtn);
    expect(playfulCardBtn).toHaveAttribute("aria-pressed", "true");

    // Product card style
    const framedProductBtn = screen.getByRole("button", {
      name: "Framed: Inset product photography",
    });
    await user.click(framedProductBtn);
    expect(framedProductBtn).toHaveAttribute("aria-pressed", "true");

    // Banner style
    const minimalBannerBtn = screen.getByRole("button", {
      name: "Minimal: Quiet and product-first",
    });
    await user.click(minimalBannerBtn);
    expect(minimalBannerBtn).toHaveAttribute("aria-pressed", "true");

    // Booth card style
    const compactBoothBtn = screen.getByRole("button", {
      name: "Compact: Social icon links and space saving",
    });
    await user.click(compactBoothBtn);
    expect(compactBoothBtn).toHaveAttribute("aria-pressed", "true");

    // Cart card style
    const compactCartBtn = screen.getByRole("button", {
      name: "Compact: Dense rows for multi-item orders",
    });
    await user.click(compactCartBtn);
    expect(compactCartBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("retains failed payment edits when storefront publication succeeds", async () => {
    const user = userEvent.setup();
    render(
      <PlatformI18nProvider>
        <ToastProvider>
          <Harness />
        </ToastProvider>
      </PlatformI18nProvider>,
    );

    await user.click(screen.getByRole("tab", { name: "Style" }));
    await user.click(screen.getByRole("button", { name: /Night Market/i }));
    await user.click(screen.getByRole("tab", { name: "Layout" }));
    await user.click(
      screen.getByRole("button", { name: "Edit Shopping cart" }),
    );
    const paymentLabel = screen.getByLabelText("Payment display name");
    await user.clear(paymentLabel);
    await user.type(paymentLabel, "Event transfer");
    await user.click(screen.getByRole("button", { name: "Publish" }));

    expect(
      await screen.findByText("Could not publish all changes"),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText("Payment display name")).toHaveValue(
        "Event transfer",
      ),
    );
  });

  it("preserves a dirty draft when a newer same-shop version arrives", async () => {
    const user = userEvent.setup();
    const view = render(renderDesigner("shop-1", defaultBooth));

    await user.click(
      screen.getByRole("button", { name: "Edit Booth information" }),
    );
    const boothName = screen.getByLabelText("Booth name");
    await user.clear(boothName);
    await user.type(boothName, "Local draft");

    view.rerender(
      renderDesigner("shop-1", {
        ...defaultBooth,
        booth_name: "Remote version",
      }),
    );

    expect(screen.getByLabelText("Booth name")).toHaveValue("Local draft");
    expect(
      screen.getByText(
        "A newer storefront version is available. Your unpublished edits are preserved until you reset them.",
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Reset unpublished changes" }),
    );
    expect(screen.getByLabelText("Booth name")).toHaveValue("Remote version");
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
  });

  it("clears draft history when the shop identity changes", async () => {
    const user = userEvent.setup();
    const view = render(renderDesigner("shop-1", defaultBooth));

    await user.click(
      screen.getByRole("button", { name: "Edit Booth information" }),
    );
    const boothName = screen.getByLabelText("Booth name");
    await user.clear(boothName);
    await user.type(boothName, "First shop draft");
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();

    view.rerender(
      renderDesigner("shop-2", {
        ...defaultBooth,
        shop_id: "shop-2",
        booth_name: "Second shop",
      }),
    );

    await waitFor(() =>
      expect(screen.getByLabelText("Booth name")).toHaveValue("Second shop"),
    );
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(
      screen.queryByText("A newer storefront version is available."),
    ).not.toBeInTheDocument();
  });
});
