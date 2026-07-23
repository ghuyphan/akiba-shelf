import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductGrid } from "./ProductGrid";

describe("ProductGrid", () => {
  afterEach(cleanup);

  it("uses booth-specific guidance for an empty storefront", () => {
    render(
      <ProductGrid
        products={[]}
        totalProducts={0}
        activeCategory="All"
        viewMode="grid"
        onSelect={vi.fn()}
        onViewDetails={vi.fn()}
        onResetFilters={vi.fn()}
        emptyMessage="Moon Booth is preparing its first release."
      />,
    );

    expect(
      screen.getByText("Moon Booth is preparing its first release."),
    ).toBeInTheDocument();
  });

  it("keeps filtered empty results distinct from an empty booth", () => {
    render(
      <ProductGrid
        products={[]}
        totalProducts={0}
        activeCategory="All"
        viewMode="grid"
        onSelect={vi.fn()}
        onViewDetails={vi.fn()}
        onResetFilters={vi.fn()}
        searchActive
        emptyMessage="Moon Booth is preparing its first release."
      />,
    );

    expect(screen.getByText("No items found")).toBeInTheDocument();
    expect(
      screen.queryByText("Moon Booth is preparing its first release."),
    ).toBeNull();
  });
});
