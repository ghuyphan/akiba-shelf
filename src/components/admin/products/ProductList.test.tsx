import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlatformI18nProvider } from "../../../lib/i18n/platformI18n";
import type { Product } from "../../../types/catalog";
import { ProductList } from "./ProductList";

const baseProduct: Product = {
  id: "product-1",
  name: "Moon stand",
  collection: "Night market",
  description: "Acrylic stand",
  price_vnd: 120_000,
  sale_price_vnd: null,
  promotion_eligible: true,
  item_code: "AST-001",
  quantity_available: 12,
  category: "Acrylic",
  badge: "",
  badge_color: "#5f8d55",
  stock_status: "in_stock",
  stock_note: "In stock",
  images: [],
  featured: true,
  sort_order: 1,
  active: true,
};

function renderList(selectedId?: string) {
  render(
    <PlatformI18nProvider>
      <ProductList
        products={[
          baseProduct,
          {
            ...baseProduct,
            id: "product-2",
            name: "Low stock pin",
            item_code: "PIN-001",
            quantity_available: 2,
            featured: false,
          },
          {
            ...baseProduct,
            id: "product-3",
            name: "Hidden print",
            item_code: "PRT-001",
            active: false,
          },
        ]}
        selectedId={selectedId}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
      />
    </PlatformI18nProvider>,
  );
}

describe("ProductList", () => {
  afterEach(cleanup);

  it("exposes understandable pressed filters and applies their stock meaning", async () => {
    const user = userEvent.setup();
    renderList();

    const filters = screen.getByRole("group", { name: "Product filters" });
    const all = within(filters).getByRole("button", { name: "all" });
    const stocked = within(filters).getByRole("button", {
      name: "Well stocked",
    });
    const featured = within(filters).getByRole("button", { name: "featured" });
    const low = within(filters).getByRole("button", {
      name: "Low / sold out",
    });
    const hidden = within(filters).getByRole("button", { name: "hidden" });

    expect(all).toHaveAttribute("aria-pressed", "true");
    for (const filter of [featured, stocked, low, hidden])
      expect(filter).toHaveAttribute("aria-pressed", "false");

    await user.click(featured);
    expect(featured).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Moon stand/ })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Low stock pin/ }),
    ).not.toBeInTheDocument();

    await user.click(stocked);
    expect(stocked).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Moon stand/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Low stock pin/ })).toBeNull();

    await user.click(low);
    expect(screen.getByRole("button", { name: /Low stock pin/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Hidden print/ })).toBeNull();

    await user.click(hidden);
    expect(screen.getByRole("button", { name: /Hidden print/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Moon stand/ })).toBeNull();
  });

  it("exposes the product currently open in the editor", () => {
    renderList("product-2");

    expect(
      screen.getByRole("button", { name: /Low stock pin/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Moon stand/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
