import { usePlatformI18n } from "../../../lib/i18n/platformI18n";
import type { AdminViewTab } from "./adminWorkspaceTypes";

type AdminViewHeroProps = {
  viewTab: AdminViewTab;
};

const viewTitles: Record<AdminViewTab, string> = {
  orders: "Orders",
  products: "Products",
  gacha: "Gacha",
  settings: "Settings",
  team: "Team",
  design: "Storefront",
};

export function AdminViewHero({ viewTab }: AdminViewHeroProps) {
  const { t } = usePlatformI18n();

  return (
    <section className={`admin-view-hero admin-view-hero-${viewTab}`}>
      <h1>{t(viewTitles[viewTab])}</h1>
    </section>
  );
}
