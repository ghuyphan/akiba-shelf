import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  BellOff,
  ClipboardList,
  EllipsisVertical,
  Gamepad2,
  Languages,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Package,
  Settings2,
  ShoppingBag,
  Store,
  Users,
} from "lucide-react";
import { AppHeader } from "../ui/AppHeader";
import { SelectMenu } from "../ui/SelectMenu";
import { useToast } from "../ui/ToastProvider";
import { useTabIndicator } from "../../hooks/useTabIndicator";
import { getErrorMessage } from "../../lib/errors";
import {
  canUsePush,
  disableOrderNotifications,
  enableOrderNotifications,
  getPushEnabled,
} from "../../lib/offline/pwa";
import {
  usePlatformI18n,
  type PlatformLocale,
} from "../../lib/i18n/platformI18n";
import { safePublicUrl } from "../../lib/branding";
import type { BoothSettings, ShopMembership } from "../../types/catalog";
import type { AdminViewTab } from "./adminWorkspaceTypes";

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
}: AdminWorkspaceHeaderProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const { t, locale, setLocale } = usePlatformI18n();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);
  const { containerRef, registerItem } = useTabIndicator<
    AdminViewTab,
    HTMLDivElement
  >(viewTab, [canManageCatalog, productsCount, pendingOrderCount]);

  useEffect(() => {
    void getPushEnabled(access.shop_id)
      .then(setPushEnabled)
      .catch(() => setPushEnabled(false));
  }, [access.shop_id]);

  useEffect(() => {
    if (!overflowOpen) return;
    const close = (event: MouseEvent) => {
      if (!overflowRef.current?.contains(event.target as Node)) {
        setOverflowOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [overflowOpen]);

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
      brand={
        <>
          <Link
            to={`/s/${access.shop_slug}`}
            aria-label={t("Back to catalog")}
            className="app-header-icon-button"
          >
            <ArrowLeft size={19} />
          </Link>
          <Link
            to="/dashboard"
            aria-label={t("Go to dashboard")}
            className="app-header-icon-button admin-dashboard-button"
          >
            <LayoutDashboard size={19} />
          </Link>
          <span
            className="app-header-mark"
            style={
              booth.logo_url
                ? { background: "transparent", overflow: "hidden" }
                : undefined
            }
          >
            {safePublicUrl(booth.logo_url) ? (
              <img src={safePublicUrl(booth.logo_url)} alt={booth.booth_name} />
            ) : (
              <ShoppingBag size={18} />
            )}
          </span>
          <span className="app-header-title">
            <strong>{booth.booth_name || t("Merch desk")}</strong>
            <small>{t("Admin workspace")}</small>
          </span>
        </>
      }
      navigation={
        <div className="admin-nav-tabs" ref={containerRef}>
          {canManageCatalog && (
            <button
              type="button"
              ref={registerItem("design")}
              className={`admin-nav-tab admin-nav-storefront ${viewTab === "design" ? "active" : ""}`}
              onClick={() => onViewTabChange("design")}
            >
              <LayoutTemplate size={15} /> {t("Storefront")}
            </button>
          )}
          <button
            type="button"
            ref={registerItem("orders")}
            className={`admin-nav-tab admin-nav-orders ${viewTab === "orders" ? "active" : ""}`}
            onClick={() => onViewTabChange("orders")}
          >
            <ClipboardList size={15} />
            <span>{t("Orders Queue")}</span>
            {pendingOrderCount > 0 && (
              <span className="admin-nav-count">{pendingOrderCount}</span>
            )}
          </button>
          {canManageCatalog && (
            <button
              type="button"
              ref={registerItem("products")}
              className={`admin-nav-tab ${viewTab === "products" ? "active" : ""}`}
              onClick={() => onViewTabChange("products")}
            >
              <Package size={15} />
              <span>{t("Products ({{count}})", { count: productsCount })}</span>
            </button>
          )}
          {canManageCatalog && (
            <button
              type="button"
              ref={registerItem("gacha")}
              className={`admin-nav-tab ${viewTab === "gacha" ? "active" : ""}`}
              onClick={() => onViewTabChange("gacha")}
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
              onClick={() => onViewTabChange("team")}
            >
              <Users size={15} /> {t("Team")}
            </button>
          )}
          {canManageCatalog && (
            <button
              type="button"
              ref={registerItem("settings")}
              className={`admin-nav-tab admin-nav-mobile-settings ${viewTab === "settings" ? "active" : ""}`}
              onClick={() => onViewTabChange("settings")}
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
              if (value === "__new") navigate("/dashboard/shops/new");
              else if (value === "__dashboard") navigate("/dashboard");
              else onSelectShop(value);
            }}
          />
          <div className="admin-overflow-menu" ref={overflowRef}>
            <button
              type="button"
              className="app-header-button admin-overflow-toggle"
              onClick={() => setOverflowOpen((open) => !open)}
              aria-label={t("More actions")}
              title={t("More actions")}
            >
              <EllipsisVertical size={15} />
            </button>
            {overflowOpen && (
              <div className="admin-overflow-popover">
                <div className="admin-overflow-item">
                  <Languages size={15} />
                  <span>{t("Language")}</span>
                  <div className="admin-overflow-lang-pills">
                    {(["en", "vi"] as PlatformLocale[]).map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={locale === item ? "active" : ""}
                        onClick={() => {
                          setLocale(item);
                          setOverflowOpen(false);
                        }}
                      >
                        {item.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                {canUsePush() && (
                  <button
                    type="button"
                    className="admin-overflow-item"
                    disabled={pushBusy}
                    onClick={() => {
                      void togglePushNotifications();
                      setOverflowOpen(false);
                    }}
                  >
                    {pushEnabled ? <Bell size={15} /> : <BellOff size={15} />}
                    <span>
                      {t(pushEnabled ? "Alerts on" : "Enable alerts")}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={signOutBusy}
            onClick={onRequestSignOut}
            className="app-header-button admin-signout-button"
            aria-label={t("Sign out")}
            title={t("Sign out")}
          >
            <LogOut size={15} />
            <span>{t("Sign out")}</span>
          </button>
        </>
      }
    />
  );
}
