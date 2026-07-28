import type { StorefrontSection } from "../../types/catalog";

export const DEFAULT_STOREFRONT_ORDER: StorefrontSection[] = [
  "featured",
  "booth",
  "controls",
  "products",
  "cart",
];

export function normalizeStorefrontOrder(
  saved?: StorefrontSection[] | null,
): StorefrontSection[] {
  return saved?.length === DEFAULT_STOREFRONT_ORDER.length &&
    DEFAULT_STOREFRONT_ORDER.every((section) => saved.includes(section))
    ? saved
    : DEFAULT_STOREFRONT_ORDER;
}

export function partitionStorefrontOrder(order: StorefrontSection[]) {
  return {
    hero: order.filter(
      (section) => section === "featured" || section === "booth",
    ),
    main: order.filter(
      (section) => section === "controls" || section === "products",
    ),
    side: order.filter((section) => section === "cart"),
  };
}

export function getStorefrontColumnPosition(
  order: StorefrontSection[],
  sections: StorefrontSection[],
  offset = 0,
) {
  return (
    sections.reduce((sum, section) => sum + order.indexOf(section), 0) /
      sections.length +
    offset
  );
}
