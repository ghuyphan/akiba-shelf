/**
 * Shared helpers for adapting the storefront to constrained network
 * conditions. Used by both the catalog and the gacha host pages.
 */
export type NetworkConnection = { effectiveType?: string; saveData?: boolean };

export function prefersLightweightCatalog() {
  const connection = (
    navigator as Navigator & { connection?: NetworkConnection }
  ).connection;
  return Boolean(
    connection?.saveData ||
      connection?.effectiveType === "slow-2g" ||
      connection?.effectiveType === "2g",
  );
}
