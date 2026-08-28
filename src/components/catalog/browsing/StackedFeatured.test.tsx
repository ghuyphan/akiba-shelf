import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CatalogLocaleProvider } from "../../../lib/i18n/catalogLocale";
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
  it("prioritizes the active artwork for high priority while rendering deck images", () => {
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
    expect(initialImages).toHaveLength(2);
    expect(initialImages[0]).toHaveAttribute(
      "src",
      "https://example.test/first.jpg",
    );
    expect(initialImages[0]).toHaveAttribute("fetchpriority", "high");
    expect(initialImages[1]).toHaveAttribute(
      "src",
      "https://example.test/second.jpg",
    );
    expect(initialImages[1]).toHaveAttribute("fetchpriority", "low");

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
    expect(image).toHaveAttribute("src", "https://example.test/first-600.webp");
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

  it("caps the mobile deck instead of rendering every featured product", () => {
    const { container } = render(
      <CatalogLocaleProvider locale="en">
        <StackedFeatured
          products={Array.from({ length: 15 }, (_, index) =>
            featuredProduct(`item-${index}`, `Item ${index}`),
          )}
          autoRotate={false}
          onSelect={vi.fn()}
        />
      </CatalogLocaleProvider>,
    );

    expect(container.querySelector(".featured-banner-count")).toHaveTextContent(
      "01 / 08",
    );
    expect(
      container.querySelectorAll(".featured-banner-nav>div>button"),
    ).toHaveLength(8);
  });

  it("never renders unfeatured products from a broad upstream response", () => {
    const { container } = render(
      <CatalogLocaleProvider locale="en">
        <StackedFeatured
          products={[
            featuredProduct("featured", "Featured print"),
            {
              ...featuredProduct("regular", "Regular print"),
              featured: false,
            },
          ]}
          autoRotate={false}
          onSelect={vi.fn()}
        />
      </CatalogLocaleProvider>,
    );

    expect(
      container.querySelector(".featured-banner-copy h2"),
    ).toHaveTextContent("Featured print");
    expect(container).not.toHaveTextContent("Regular print");
    expect(container.querySelectorAll(".featured-deck-card")).toHaveLength(1);
  });
});
