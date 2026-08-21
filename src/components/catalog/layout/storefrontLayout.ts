import type {
  StorefrontLayoutPreset,
  StorefrontSection,
} from "../../../types/catalog";

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

export function partitionStorefrontOrder(
  order: StorefrontSection[],
  preset: StorefrontLayoutPreset = "split",
  hiddenSections: StorefrontSection[] = [],
) {
  const visibleOrder = order.filter(
    (section) => !hiddenSections.includes(section),
  );

  switch (preset) {
    case "full_hero": {
      const hero = visibleOrder.filter((section) => section === "featured");
      const side = visibleOrder.filter((section) => section === "cart");
      const main = visibleOrder.filter(
        (section) => section !== "featured" && section !== "cart",
      );
      return { hero, main, side };
    }
    case "sidebar_booth": {
      const hero: StorefrontSection[] = [];
      const side = visibleOrder.filter(
        (section) => section === "booth" || section === "cart",
      );
      const main = visibleOrder.filter(
        (section) => section !== "booth" && section !== "cart",
      );
      return { hero, main, side };
    }
    case "stacked": {
      return {
        hero: visibleOrder,
        main: [] as StorefrontSection[],
        side: [] as StorefrontSection[],
      };
    }
    case "split":
    default: {
      return {
        hero: visibleOrder.filter(
          (section) => section === "featured" || section === "booth",
        ),
        main: visibleOrder.filter(
          (section) => section === "controls" || section === "products",
        ),
        side: visibleOrder.filter((section) => section === "cart"),
      };
    }
  }
}

export function getStorefrontColumnPosition(
  order: StorefrontSection[],
  sections: StorefrontSection[],
  offset = 0,
) {
  if (sections.length === 0) return offset;
  return (
    sections.reduce((sum, section) => sum + order.indexOf(section), 0) /
      sections.length +
    offset
  );
}
