import type { StorefrontSection } from "../../../types/catalog";

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
  if (sections.length === 0) return 0;
  return (
    sections.reduce((sum, section) => sum + order.indexOf(section), 0) /
      sections.length +
    offset
  );
}

export type StorefrontLayoutStructure = {
  hero: StorefrontSection[];
  heroStyle: "split" | "full_featured" | "full_booth" | "none";
  contentColumns: Array<{
    key: "main" | "side";
    sections: StorefrontSection[];
    position: number;
  }>;
};

export function resolveStorefrontLayout(
  order: StorefrontSection[],
): StorefrontLayoutStructure {
  const normOrder = normalizeStorefrontOrder(order);
  const first = normOrder[0];
  const second = normOrder[1];

  let hero: StorefrontSection[] = [];
  let heroStyle: "split" | "full_featured" | "full_booth" | "none" = "none";
  let bodyOrder = [...normOrder];

  if (
    (first === "featured" && second === "booth") ||
    (first === "booth" && second === "featured")
  ) {
    hero = [first, second];
    heroStyle = "split";
    bodyOrder = normOrder.slice(2);
  } else if (first === "featured") {
    hero = ["featured"];
    heroStyle = "full_featured";
    bodyOrder = normOrder.slice(1);
  } else if (first === "booth") {
    hero = ["booth"];
    heroStyle = "full_booth";
    bodyOrder = normOrder.slice(1);
  }

  const mainSections = bodyOrder.filter(
    (sec) => sec === "controls" || sec === "products" || sec === "featured",
  );
  const sideSections = bodyOrder.filter(
    (sec) => sec === "cart" || sec === "booth",
  );

  const contentColumns: Array<{
    key: "main" | "side";
    sections: StorefrontSection[];
    position: number;
  }> = [];

  if (mainSections.length > 0) {
    contentColumns.push({
      key: "main",
      sections: mainSections,
      position: getStorefrontColumnPosition(normOrder, mainSections),
    });
  }

  if (sideSections.length > 0) {
    contentColumns.push({
      key: "side",
      sections: sideSections,
      position: getStorefrontColumnPosition(normOrder, sideSections, -0.01),
    });
  }

  contentColumns.sort(
    (firstCol, secondCol) => firstCol.position - secondCol.position,
  );

  return {
    hero,
    heroStyle,
    contentColumns,
  };
}
