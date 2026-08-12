import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlatformI18nProvider } from "../../../lib/i18n/platformI18n";
import type { Product } from "../../../types/catalog";
import { ToastProvider } from "../../ui/ToastProvider";
import { ProductForm } from "./ProductForm";

const uploadMocks = vi.hoisted(() => ({
  onProductUploaded: undefined as
    | ((variant: {
        thumbnail: string;
        detail: string;
        paths: string[];
      }) => void)
    | undefined,
}));

vi.mock("../shared/ImageUpload", () => ({
  ImageUpload: (props: {
    label: string;
    onProductUploaded?: typeof uploadMocks.onProductUploaded;
  }) => {
    uploadMocks.onProductUploaded = props.onProductUploaded;
    return <button type="button">{props.label}</button>;
  },
}));

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

function renderForm(
  onDelete = vi.fn().mockResolvedValue(undefined),
  featuredCount = 0,
  onSave = vi.fn().mockResolvedValue(undefined),
) {
  render(
    <PlatformI18nProvider>
      <ToastProvider>
        <ProductForm
          shopId="shop-1"
          product={product}
          featuredCount={featuredCount}
          onSave={onSave}
          onDelete={onDelete}
        />
      </ToastProvider>
    </PlatformI18nProvider>,
  );
  return onDelete;
}

describe("ProductForm", () => {
  afterEach(() => {
    cleanup();
    uploadMocks.onProductUploaded = undefined;
  });

  it("keeps dirty fields when realtime refreshes the same product", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <PlatformI18nProvider>
        <ToastProvider>
          <ProductForm
            shopId="shop-1"
            product={product}
            featuredCount={0}
            onSave={vi.fn()}
            onDelete={vi.fn()}
          />
        </ToastProvider>
      </PlatformI18nProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const name = screen.getByRole("textbox", {
      name: "Product name · Required",
    });
    await user.clear(name);
    await user.type(name, "Local draft");

    rerender(
      <PlatformI18nProvider>
        <ToastProvider>
          <ProductForm
            shopId="shop-1"
            product={{ ...product, quantity_available: 4 }}
            featuredCount={0}
            onSave={vi.fn()}
            onDelete={vi.fn()}
          />
        </ToastProvider>
      </PlatformI18nProvider>,
    );

    expect(name).toHaveValue("Local draft");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("merges a completed upload into the latest draft", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderForm(undefined, 0, onSave);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const name = screen.getByRole("textbox", {
      name: "Product name · Required",
    });
    await user.clear(name);
    await user.type(name, "Edited during upload");

    act(() => {
      uploadMocks.onProductUploaded?.({
        thumbnail: "https://example.com/new-thumb.jpg",
        detail: "https://example.com/new-detail.jpg",
        paths: ["thumb-path", "detail-path"],
      });
    });
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Edited during upload",
        images: [
          "https://example.com/product.jpg",
          "https://example.com/new-detail.jpg",
        ],
      }),
    );
  });

  it("uses the shared destructive confirmation before deleting", async () => {
    const user = userEvent.setup();
    const onDelete = renderForm();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(
      screen.getByRole("dialog", { name: "Delete product?" }),
    ).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete product" }));
    expect(onDelete).toHaveBeenCalledWith("product-1");
  });

  it("associates the item-code validation message with its input", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const itemCode = screen.getByRole("textbox", {
      name: "Item code · Required",
    });
    await user.clear(itemCode);
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const error = await screen.findByText("Item code is required.");
    expect(error).toHaveAttribute("role", "alert");
    expect(itemCode).toHaveAttribute("aria-describedby", error.id);
    expect(itemCode).toHaveAttribute("aria-invalid", "true");
  });

  it("shows and enforces the featured product cap", async () => {
    const user = userEvent.setup();
    renderForm(undefined, 8);

    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(
      screen.getByText("All 8 featured slots are used."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /Feature this item/ }),
    ).toBeDisabled();
  });

  it("updates the featured slot count before saving", async () => {
    const user = userEvent.setup();
    renderForm(undefined, 7);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(
      screen.getByRole("checkbox", { name: /Feature this item/ }),
    );

    expect(
      screen.getByText("All 8 featured slots are used."),
    ).toBeInTheDocument();
  });

  it("keeps save failures in the form until staff dismisses them", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error("Network unavailable"));
    renderForm(undefined, 0, onSave);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.type(
      screen.getByRole("textbox", { name: "Product name · Required" }),
      " updated",
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent("Could not update item");
    expect(error).toHaveTextContent("Network unavailable");
    expect(error).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Dismiss notification" }),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
