import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlatformI18nProvider } from "../../../lib/i18n/platformI18n";
import type { PromotionSettings } from "../../../types/catalog";
import { ToastProvider } from "../../ui/ToastProvider";
import { PromotionSettingsForm } from "./PromotionSettingsForm";

afterEach(cleanup);

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

  it("lets staff replace promotion quantities without fighting the input", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <PlatformI18nProvider>
        <ToastProvider>
          <PromotionSettingsForm
            promotion={promotion}
            products={[]}
            onSave={onSave}
          />
        </ToastProvider>
      </PlatformI18nProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const buyQuantity = screen.getByRole("textbox", {
      name: "Customer buys",
    });
    const freeQuantity = screen.getByRole("textbox", {
      name: "Customer gets free",
    });

    await user.click(buyQuantity);
    await user.keyboard("3");
    expect(buyQuantity).toHaveValue("3");
    await user.click(freeQuantity);
    await user.keyboard("2");
    expect(freeQuantity).toHaveValue("2");
    expect(buyQuantity).toHaveValue("3");
    await user.click(screen.getByRole("button", { name: "Save promotion" }));

    expect(onSave).toHaveBeenCalledWith({
      ...promotion,
      buy_quantity: 3,
      free_quantity: 2,
    });
  });
});
