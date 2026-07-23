import { usePlatformI18n } from "../../../lib/i18n/platformI18n";
import type { BoothSettings } from "../../../types/catalog";
import type { AdminViewTab } from "./adminWorkspaceTypes";

type AdminViewHeroProps = {
  viewTab: AdminViewTab;
  booth: BoothSettings;
  productsCount: number;
  lowStockCount: number;
  hiddenCount: number;
  pendingOrderCount: number;
  matchingOrderCount: number;
};

const viewCopy: Record<
  AdminViewTab,
  { eyebrow: string; title: string; description: string }
> = {
  orders: {
    eyebrow: "Live operations",
    title: "Orders",
    description: "Confirm payments and fulfil orders.",
  },
  products: {
    eyebrow: "Catalog management",
    title: "Products",
    description: "Manage products, prices, and stock.",
  },
  gacha: {
    eyebrow: "Minigame studio",
    title: "Gacha",
    description:
      "Turn your merch into characters and weapons for a free minigame.",
  },
  settings: {
    eyebrow: "Shop configuration",
    title: "Settings",
    description: "Update booth and payment details.",
  },
  team: {
    eyebrow: "Access management",
    title: "Team",
    description: "Invite teammates and control access to this shop.",
  },
  design: {
    eyebrow: "Visual storefront",
    title: "Storefront designer",
    description: "Build your storefront and checkout.",
  },
};

export function AdminViewHero({
  viewTab,
  booth,
  productsCount,
  lowStockCount,
  hiddenCount,
  pendingOrderCount,
  matchingOrderCount,
}: AdminViewHeroProps) {
  const { t } = usePlatformI18n();
  const copy = viewCopy[viewTab];

  return (
    <section className={`admin-view-hero admin-view-hero-${viewTab}`}>
      <div>
        <span>{t(copy.eyebrow)}</span>
        <h1>{t(copy.title)}</h1>
        <p>{t(copy.description)}</p>
      </div>
      <div className="admin-view-hero-actions">
        <div className="admin-view-chips">
          {viewTab === "orders" && (
            <>
              <span>
                <b>{pendingOrderCount}</b> {t("pending")}
              </span>
              <span>
                <b>{matchingOrderCount}</b> {t("matching orders")}
              </span>
            </>
          )}
          {viewTab === "products" && (
            <>
              <span>
                <b>{productsCount}</b> {t("total")}
              </span>
              <span>
                <b>{lowStockCount}</b> {t("need attention")}
              </span>
              <span>
                <b>{hiddenCount}</b> {t("hidden")}
              </span>
            </>
          )}
          {viewTab === "design" && (
            <>
              <span>
                <b>{booth.corner_radius ?? 16}px</b> {t("corners")}
              </span>
              <span>
                <b>{(booth.catalog_locale ?? "en").toUpperCase()}</b>{" "}
                {t("locale")}
              </span>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
