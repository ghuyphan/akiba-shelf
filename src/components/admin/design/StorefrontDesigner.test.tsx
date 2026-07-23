import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { defaultBooth, defaultPayment } from "../../../lib/constants";
import { PlatformI18nProvider } from "../../../lib/i18n/platformI18n";
import type { BoothSettings } from "../../../types/catalog";
import { ToastProvider } from "../../ui/ToastProvider";
import { StorefrontDesigner } from "./StorefrontDesigner";

vi.mock("../../catalog/shell/CatalogHeader", () => ({ CatalogHeader: () => null }));
vi.mock("../../catalog/browsing/CategoryFilters", () => ({ CategoryFilters: () => null }));
vi.mock("../../catalog/browsing/CatalogToolbar", () => ({ CatalogToolbar: () => null }));
vi.mock("../../catalog/browsing/ProductGrid", () => ({ ProductGrid: () => null }));
vi.mock("../../catalog/browsing/StackedFeatured", () => ({ StackedFeatured: () => null }));
vi.mock("../../catalog/shell/BoothInfoPanel", () => ({ BoothInfoPanel: () => null }));
vi.mock("../../catalog/cart/SelectedItemPanel", () => ({ SelectedItemPanel: () => null }));

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
});

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
    const paymentLabel = screen.getByLabelText("Payment label");
    await user.clear(paymentLabel);
    await user.type(paymentLabel, "Event transfer");
    await user.click(screen.getByRole("button", { name: "Publish" }));

    expect(
      await screen.findByText("Could not publish all changes"),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText("Payment label")).toHaveValue(
        "Event transfer",
      ),
    );
  });
});
