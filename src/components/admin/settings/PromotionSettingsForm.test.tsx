import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import { PlatformI18nProvider } from "../../../lib/i18n/platformI18n";
import type { PromotionSettings } from "../../../types/catalog";
import { ToastProvider } from "../../ui/ToastProvider";
import { AdminUnsavedChangesProvider } from "../shell/AdminUnsavedChanges";
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
  function renderForm(onSave = vi.fn().mockResolvedValue(undefined)) {
    const router = createMemoryRouter([
      {
        path: "/",
        element: (
          <PlatformI18nProvider>
            <ToastProvider>
              <AdminUnsavedChangesProvider>
                <PromotionSettingsForm
                  promotion={promotion}
                  products={[]}
                  onSave={onSave}
                />
              </AdminUnsavedChangesProvider>
            </ToastProvider>
          </PlatformI18nProvider>
        ),
      },
    ]);
    render(<RouterProvider router={router} />);
    return onSave;
  }

  it("uses the admin modal and explains an empty catalog", async () => {
    const user = userEvent.setup();
    renderForm();

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
    renderForm(onSave);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const buyQuantity = screen.getByRole("textbox", {
      name: "Customer buys",
    });
    const freeQuantity = screen.getByRole("textbox", {
      name: "Free quantity",
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

  it("guards closing a changed promotion and discards only after confirmation", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const buyQuantity = screen.getByRole("textbox", {
      name: "Customer buys",
    });
    await user.click(buyQuantity);
    await user.keyboard("4");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      screen.getByRole("dialog", { name: "Discard unsaved changes?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "Quantity promotion" }),
    ).toBeInTheDocument();

    const confirmation = screen.getByRole("dialog", {
      name: "Discard unsaved changes?",
    });
    await user.click(
      within(
        confirmation.querySelector(".confirmation-dialog-actions")!,
      ).getByRole("button", { name: "Keep editing" }),
    );
    expect(buyQuantity).toHaveValue("4");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Quantity promotion" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("keeps save failures in the editor until dismissed", async () => {
    const user = userEvent.setup();
    renderForm(vi.fn().mockRejectedValue(new Error("Network unavailable")));

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const buyQuantity = screen.getByRole("textbox", {
      name: "Customer buys",
    });
    await user.click(buyQuantity);
    await user.keyboard("4");
    await user.click(screen.getByRole("button", { name: "Save promotion" }));

    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent("Could not save promotion");
    expect(error).toHaveTextContent("Network unavailable");
    expect(
      screen.getByRole("dialog", { name: "Quantity promotion" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Dismiss notification" }),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
