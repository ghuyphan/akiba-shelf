import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlatformI18nProvider } from "../../lib/i18n/platformI18n";
import type { Product } from "../../types/catalog";
import { ToastProvider } from "../ui/ToastProvider";
import { ProductForm } from "./ProductForm";

const product: Product = {
  id: "product-1",
  name: "Moonlight stand",
  collection: "Night market",
  description: "Acrylic stand",
  price_vnd: 120_000,
  sale_price_vnd: null,
  promotion_eligible: true,
  item_code: "AST-001",
  quantity_available: 5,
  category: "Acrylic",
  badge: "",
  badge_color: "#5f8d55",
  stock_status: "in_stock",
  stock_note: "In stock",
  images: ["https://example.com/product.jpg"],
  featured: false,
  sort_order: 1,
  active: true,
};

function renderForm(onDelete = vi.fn().mockResolvedValue(undefined)) {
  render(
    <PlatformI18nProvider>
      <ToastProvider>
        <ProductForm
          shopId="shop-1"
          product={product}
          onSave={vi.fn().mockResolvedValue(undefined)}
          onDelete={onDelete}
        />
      </ToastProvider>
    </PlatformI18nProvider>,
  );
  return onDelete;
}

describe("ProductForm", () => {
  it("uses the shared destructive confirmation before deleting", async () => {
    const user = userEvent.setup();
    const onDelete = renderForm();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog", { name: "Delete product?" })).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete product" }));
    expect(onDelete).toHaveBeenCalledWith("product-1");
  });
});
