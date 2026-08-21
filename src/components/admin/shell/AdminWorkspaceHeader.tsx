import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  ArrowLeft,
  Bell,
  BellOff,
  ClipboardList,
  EllipsisVertical,
  Gamepad2,
  Heart,
  HelpCircle,
  Languages,
  LayoutTemplate,
  LogOut,
  Package,
  Settings2,
  ShoppingBag,
  Store,
  Users,
} from "lucide-react";
import { AppHeader } from "../../ui/AppHeader";
import { ActionMenu } from "../../ui/ActionMenu";
import { SelectMenu } from "../../ui/SelectMenu";
import { useToast } from "../../ui/ToastProvider";
import { useTabIndicator } from "../../../hooks/shared/useTabIndicator";
import { getErrorMessage } from "../../../lib/errors";
import {
  canUsePush,
  disableOrderNotifications,
  enableOrderNotifications,
  getPushEnabled,
} from "../../../lib/offline/pwa";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";
import { safePublicUrl } from "../../../lib/branding";
import type { BoothSettings, ShopMembership } from "../../../types/catalog";
import type { AdminViewTab } from "./adminWorkspaceTypes";
import type { GuideSection } from "./AdminGuideModal";
import { useAdminNavigationGuard } from "./AdminUnsavedChanges";

type AdminWorkspaceHeaderProps = {
  booth: BoothSettings;
  access: ShopMembership;
  memberships: ShopMembership[];
  viewTab: AdminViewTab;
  productsCount: number;
  pendingOrderCount: number;
  canManageCatalog: boolean;
  canCreateShop: boolean;
  signOutBusy: boolean;
  onViewTabChange: (tab: AdminViewTab) => void;
  onSelectShop: (shopId: string) => void;
  onRequestSignOut: () => void;
  onOpenGuide: (section?: GuideSection) => void;
};

export function AdminWorkspaceHeader({
  booth,
  access,
  memberships,
  viewTab,
  productsCount,
  pendingOrderCount,
  canManageCatalog,
  canCreateShop,
  signOutBusy,
  onViewTabChange,
  onSelectShop,
  onRequestSignOut,
  onOpenGuide,
}: AdminWorkspaceHeaderProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const { locale, setLocale, t } = usePlatformI18n();
  const requestNavigation = useAdminNavigationGuard();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const { containerRef, registerItem } = useTabIndicator<
    AdminViewTab,
    HTMLDivElement
  >(viewTab, [canManageCatalog, productsCount, pendingOrderCount]);

  useEffect(() => {
    void getPushEnabled(access.shop_id)
      .then(setPushEnabled)
      .catch(() => setPushEnabled(false));
  }, [access.shop_id]);

  async function togglePushNotifications() {
    setPushBusy(true);
    try {
      if (pushEnabled) await disableOrderNotifications(access.shop_id);
      else await enableOrderNotifications(access.shop_id);
      setPushEnabled((current) => !current);
      toast.success(
        t(
          pushEnabled
            ? "Order notifications disabled."
            : "Order notifications enabled on this device.",
        ),
      );
    } catch (error) {
      toast.error(
        t(getErrorMessage(error, "Could not update notifications.")),
        t("Notifications unavailable"),
      );
    } finally {
      setPushBusy(false);
    }
  }

  const showTeam = access.role === "owner";

  return (
    <AppHeader
      className="admin-workspace-header"
      brand={
        <>
          <Link
            to={`/s/${access.shop_slug}`}
            aria-label={t("Back to storefront")}
            className="app-header-icon-button"
            onClick={(event) => {
              event.preventDefault();
              requestNavigation(() => navigate(`/s/${access.shop_slug}`));
            }}
          >
            <ArrowLeft size={19} />
          </Link>
          <Link
            to="/dashboard"
            aria-label={t("Go to dashboard")}
            className="admin-workspace-identity"
            onClick={(event) => {
              event.preventDefault();
              requestNavigation(() => navigate("/dashboard"));
            }}
          >
            <span
              className="app-header-mark"
              style={
                booth.logo_url
                  ? { background: "transparent", overflow: "hidden" }
                  : undefined
              }
            >
              {safePublicUrl(booth.logo_url) ? (
                <img src={safePublicUrl(booth.logo_url)} alt="" />
              ) : (
                <ShoppingBag size={18} />
              )}
            </span>
            <span className="app-header-title">
              <strong>{booth.booth_name || t("Merch desk")}</strong>
              <small>{t("Shop workspace")}</small>
            </span>
          </Link>
        </>
      }
      navigation={
        <div
          className="admin-nav-tabs"
          ref={containerRef}
          role="navigation"
          aria-label={t("Admin sections")}
        >
          {canManageCatalog && (
            <button
              type="button"
              ref={registerItem("design")}
              className={`admin-nav-tab admin-nav-storefront ${viewTab === "design" ? "active" : ""}`}
              aria-pressed={viewTab === "design"}
              aria-current={viewTab === "design" ? "page" : undefined}
              onClick={() => requestNavigation(() => onViewTabChange("design"))}
            >
              <LayoutTemplate size={15} /> {t("Storefront")}
            </button>
          )}
          <button
            type="button"
            ref={registerItem("orders")}
            className={`admin-nav-tab admin-nav-orders ${viewTab === "orders" ? "active" : ""}`}
            aria-label={t("Order queue")}
            aria-pressed={viewTab === "orders"}
            aria-current={viewTab === "orders" ? "page" : undefined}
            onClick={() => requestNavigation(() => onViewTabChange("orders"))}
          >
            <ClipboardList size={15} />
            <span>{t("Orders")}</span>
            {pendingOrderCount > 0 && (
              <span className="admin-nav-count" aria-hidden="true">
                {pendingOrderCount}
              </span>
            )}
          </button>
          {canManageCatalog && (
            <button
              type="button"
              ref={registerItem("products")}
              className={`admin-nav-tab ${viewTab === "products" ? "active" : ""}`}
              aria-label={t("Products ({{count}})", { count: productsCount })}
              aria-pressed={viewTab === "products"}
              aria-current={viewTab === "products" ? "page" : undefined}
              onClick={() =>
                requestNavigation(() => onViewTabChange("products"))
              }
            >
              <Package size={15} />
              <span>{t("Products")}</span>
              <span
                className="admin-nav-count admin-nav-count-products"
                aria-hidden="true"
              >
                {productsCount}
              </span>
            </button>
          )}
          {canManageCatalog && (
            <button
              type="button"
              ref={registerItem("gacha")}
              className={`admin-nav-tab ${viewTab === "gacha" ? "active" : ""}`}
              aria-pressed={viewTab === "gacha"}
              aria-current={viewTab === "gacha" ? "page" : undefined}
              onClick={() => requestNavigation(() => onViewTabChange("gacha"))}
            >
              <Gamepad2 size={15} />
              <span>{t("Gacha")}</span>
            </button>
          )}
          {showTeam && (
            <button
              type="button"
              ref={registerItem("team")}
              className={`admin-nav-tab ${viewTab === "team" ? "active" : ""}`}
              aria-pressed={viewTab === "team"}
              aria-current={viewTab === "team" ? "page" : undefined}
              onClick={() => requestNavigation(() => onViewTabChange("team"))}
            >
              <Users size={15} /> {t("Team")}
            </button>
          )}
          {canManageCatalog && (
            <button
              type="button"
              ref={registerItem("settings")}
              className={`admin-nav-tab admin-nav-mobile-settings ${viewTab === "settings" ? "active" : ""}`}
              aria-pressed={viewTab === "settings"}
              aria-current={viewTab === "settings" ? "page" : undefined}
              onClick={() =>
                requestNavigation(() => onViewTabChange("settings"))
              }
            >
              <Settings2 size={15} /> {t("Settings")}
            </button>
          )}
        </div>
      }
      actions={
        <>
          <SelectMenu
            className="admin-shop-switcher-menu"
            label={t("Active shop")}
            value={access.shop_id}
            options={[
              ...memberships.map((membership) => ({
                value: membership.shop_id,
                label: membership.shop_name,
                description: `${t(membership.active && membership.shop_active ? "Active" : "Unavailable")} · ${t(membership.role)}`,
                icon: <Store size={15} />,
                disabled: !membership.active || !membership.shop_active,
              })),
              {
                value: "__dashboard",
                label: t("All shops"),
                description: t("Open platform dashboard"),
                fixed: true,
              },
              {
                value: "__new",
                label: t("Create another shop"),
                description: t(
                  canCreateShop
                    ? "Set up a new storefront"
                    : "Shop creation limit reached",
                ),
                fixed: true,
                disabled: !canCreateShop,
              },
            ]}
            onChange={(value) => {
              requestNavigation(() => {
                if (value === "__new") navigate("/dashboard/shops/new");
                else if (value === "__dashboard") navigate("/dashboard");
                else onSelectShop(value);
              });
            }}
          />
          <button
            type="button"
            className="app-header-button admin-guide-toggle"
            aria-label={t("Booth guide & playbook")}
            title={t("Booth guide & playbook")}
            onClick={() => onOpenGuide()}
          >
            <HelpCircle size={15} />
            <span className="admin-guide-label">{t("Guide")}</span>
          </button>
          <ActionMenu
            className="admin-overflow-menu"
            dataGuideSpotlight="push-notifications"
            label={t("More actions")}
            triggerIcon={<EllipsisVertical size={15} />}
            triggerClassName="app-header-button admin-overflow-toggle"
            popoverClassName="admin-overflow-popover"
            itemClassName="admin-overflow-item"
            items={[
              {
                id: "language",
                label: locale === "vi" ? "English" : "Tiếng Việt",
                icon: <Languages size={15} />,
                onSelect: () => setLocale(locale === "vi" ? "en" : "vi"),
              },
              ...(canUsePush()
                ? [
                    {
                      id: "notifications",
                      label: t(pushEnabled ? "Alerts on" : "Enable alerts"),
                      icon: pushEnabled ? (
                        <Bell size={15} />
                      ) : (
                        <BellOff size={15} />
                      ),
                      disabled: pushBusy,
                      onSelect: () => void togglePushNotifications(),
                    },
                  ]
                : []),
              {
                id: "support",
                label: t("Support Matsuri"),
                icon: <Heart size={15} />,
                onSelect: () =>
                  requestNavigation(() => navigate("/support")),
              },
              {
                id: "sign-out",
                label: t("Sign out"),
                icon: <LogOut size={15} />,
                danger: true,
                disabled: signOutBusy,
                onSelect: () => requestNavigation(onRequestSignOut),
              },
            ]}
          />
        </>
      }
    />
  );
}
