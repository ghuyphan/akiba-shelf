import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CatalogLocaleProvider } from "../../../lib/i18n/catalogI18n";
import type { Product } from "../../../types/catalog";
import { StackedFeatured } from "./StackedFeatured";

function featuredProduct(id: string, name: string): Product {
  return {
    id,
    name,
    collection: "Featured",
    description: `${name} description`,
    price_vnd: 50_000,
    item_code: id.toUpperCase(),
    quantity_available: 10,
    category: "Print",
    stock_status: "in_stock",
    stock_note: "In stock",
    images: [`https://example.test/${id}.jpg`],
    featured: true,
    sort_order: 0,
    active: true,
  };
}

describe("StackedFeatured", () => {
  it("loads only the active artwork until another card is selected", () => {
    const { container } = render(
      <CatalogLocaleProvider locale="en">
        <StackedFeatured
          products={[
            featuredProduct("first", "First print"),
            featuredProduct("second", "Second print"),
          ]}
          autoRotate={false}
          onSelect={vi.fn()}
        />
      </CatalogLocaleProvider>,
    );

    const initialImages = container.querySelectorAll(".featured-deck-card img");
    expect(initialImages).toHaveLength(1);
    expect(initialImages[0]).toHaveAttribute(
      "src",
      "https://example.test/first.jpg",
    );
    expect(initialImages[0]).toHaveAttribute("fetchpriority", "high");

    fireEvent.load(initialImages[0]);

    const cards = container.querySelectorAll<HTMLButtonElement>(
      ".featured-deck-card",
    );
    expect(cards).toHaveLength(2);
    fireEvent.click(cards[1]);

    const activeImage = container.querySelector(
      ".featured-deck-card.is-active img",
    );
    expect(activeImage).toHaveAttribute(
      "src",
      "https://example.test/second.jpg",
    );
    expect(activeImage).toHaveAttribute("fetchpriority", "high");
    expect(container.querySelectorAll(".featured-deck-card img")).toHaveLength(
      2,
    );
  });

  it("keeps the LCP image on the small variant for constrained connections", () => {
    const product = {
      ...featuredProduct("first", "First print"),
      image_variants: [
        {
          thumbnail: "https://example.test/first-600.webp",
          detail: "https://example.test/first-1400.webp",
        },
      ],
    };
    const { container } = render(
      <CatalogLocaleProvider locale="en">
        <StackedFeatured
          products={[product]}
          lightweightImages
          autoRotate={false}
          onSelect={vi.fn()}
        />
      </CatalogLocaleProvider>,
    );

    const image = container.querySelector(".featured-deck-card img");
    expect(image).toHaveAttribute(
      "src",
      "https://example.test/first-600.webp",
    );
    expect(image).not.toHaveAttribute("srcset");
  });

  it("waits for customer interaction before starting autoplay", () => {
    vi.useFakeTimers();
    const { container } = render(
      <CatalogLocaleProvider locale="en">
        <StackedFeatured
          products={[
            featuredProduct("first", "First print"),
            featuredProduct("second", "Second print"),
          ]}
          onSelect={vi.fn()}
        />
      </CatalogLocaleProvider>,
    );

    act(() => vi.advanceTimersByTime(9000));
    expect(
      container.querySelector(".featured-banner-copy h2"),
    ).toHaveTextContent("First print");

    fireEvent.pointerDown(window);
    act(() => vi.advanceTimersByTime(4500));
    expect(
      container.querySelector(".featured-banner-copy h2"),
    ).toHaveTextContent("Second print");

    vi.useRealTimers();
  });
});
