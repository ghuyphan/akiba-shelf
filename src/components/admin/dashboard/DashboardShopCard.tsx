import { Edit3, ExternalLink, Store } from "lucide-react";
import { Link } from "react-router-dom";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";
import type { ShopMembership } from "../../../types/catalog";
import { Button } from "../../ui/Button";

type DashboardShopCardProps = {
  shop: ShopMembership;
  onManage: (shopId: string) => void;
  onEdit: (shop: ShopMembership) => void;
};

export function DashboardShopCard({
  shop,
  onManage,
  onEdit,
}: DashboardShopCardProps) {
  const { t } = usePlatformI18n();
  const available = shop.active && shop.shop_active;

  return (
    <article className={`dashboard-shop-card ${available ? "" : "inactive"}`}>
      <div className="shop-card-main">
        <div className="shop-card-icon">
          <Store size={22} />
        </div>
        <div className="shop-card-details">
          <div className="shop-card-title-row">
            <h3>{shop.shop_name}</h3>
            {available && shop.role === "owner" && (
              <button
                type="button"
                className="shop-card-edit-btn"
                onClick={() => onEdit(shop)}
                aria-label={t("Edit shop details")}
                title={t("Edit shop details")}
              >
                <Edit3 size={13} />
              </button>
            )}
          </div>
          <code className="shop-card-slug">/s/{shop.shop_slug}</code>
        </div>
        <span className={`role-pill ${available ? `role-${shop.role}` : "role-unavailable"}`}>
          {available
            ? t(shop.role)
            : shop.shop_active
              ? t("Access disabled")
              : t("Shop unavailable")}
        </span>
      </div>
      <div className="shop-card-actions">
        {available && (
          <Button
            variant="primary"
            onClick={() => onManage(shop.shop_id)}
            className="shop-card-manage-btn"
          >
            {t("Manage shop")}
          </Button>
        )}
        {shop.shop_active && (
          <Link
            to={`/s/${shop.shop_slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="button button-secondary shop-card-preview-btn"
          >
            <ExternalLink size={15} />
            <span>{t("Storefront")}</span>
          </Link>
        )}
      </div>
    </article>
  );
}
