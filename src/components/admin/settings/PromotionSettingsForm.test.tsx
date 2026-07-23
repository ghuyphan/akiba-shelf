import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlatformI18nProvider } from "../../../lib/i18n/platformI18n";
import type { PromotionSettings } from "../../../types/catalog";
import { ToastProvider } from "../../ui/ToastProvider";
import { PromotionSettingsForm } from "./PromotionSettingsForm";

const promotion: PromotionSettings = {
  enabled: false,
  buy_quantity: 2,
  free_quantity: 1,
  repeatable: false,
  qualifying_product_ids: [],
  reward_product_ids: [],
};

describe("PromotionSettingsForm", () => {
  it("uses the admin modal and explains an empty catalog", async () => {
    const user = userEvent.setup();
    render(
      <PlatformI18nProvider>
        <ToastProvider>
          <PromotionSettingsForm
            promotion={promotion}
            products={[]}
            onSave={vi.fn().mockResolvedValue(undefined)}
          />
        </ToastProvider>
      </PlatformI18nProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = screen.getByRole("dialog", { name: "Quantity promotion" });
    expect(dialog).toHaveClass("modal-admin");
    expect(screen.getByText("No products available")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Add products before choosing which items qualify for this promotion.",
      ),
    ).toBeInTheDocument();
  });
});
