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
  const requestNavigation = useAdminNavigationGuard();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);
  const overflowToggleRef = useRef<HTMLButtonElement>(null);
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
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOverflowOpen(false);
      overflowToggleRef.current?.focus();
    };
    document.addEventListener("keydown", closeOnEscape);
    window.requestAnimationFrame(() => {
      overflowRef.current
        ?.querySelector<HTMLButtonElement>(".admin-overflow-popover button")
        ?.focus();
    });
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
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
      className="admin-workspace-header"
      brand={
        <>
          <Link
            to={`/s/${access.shop_slug}`}
            aria-label={t("Back to catalog")}
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
              <small>{t("Admin workspace")}</small>
            </span>
          </Link>
        </>
      }
      navigation={
        <div className="admin-nav-tabs" ref={containerRef} role="toolbar" aria-label={t("Admin sections")}>
          {canManageCatalog && (
            <button
              type="button"
              ref={registerItem("design")}
              className={`admin-nav-tab admin-nav-storefront ${viewTab === "design" ? "active" : ""}`}
              aria-pressed={viewTab === "design"}
              onClick={() => requestNavigation(() => onViewTabChange("design"))}
            >
              <LayoutTemplate size={15} /> {t("Storefront")}
            </button>
          )}
          <button
            type="button"
            ref={registerItem("orders")}
            className={`admin-nav-tab admin-nav-orders ${viewTab === "orders" ? "active" : ""}`}
            aria-label={t("Orders Queue")}
            aria-pressed={viewTab === "orders"}
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
              onClick={() => requestNavigation(() => onViewTabChange("products"))}
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
              onClick={() => requestNavigation(() => onViewTabChange("settings"))}
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
          <div className="admin-overflow-menu" ref={overflowRef}>
            <button
              ref={overflowToggleRef}
              type="button"
              className="app-header-button admin-overflow-toggle"
              onClick={() => setOverflowOpen((open) => !open)}
              aria-label={t("More actions")}
              aria-expanded={overflowOpen}
              aria-controls="admin-overflow-popover"
              title={t("More actions")}
            >
              <EllipsisVertical size={15} />
            </button>
            {overflowOpen && (
              <div className="admin-overflow-popover" id="admin-overflow-popover">
                <div className="admin-overflow-item">
                  <Languages size={15} />
                  <span>{t("Language")}</span>
                  <div className="admin-overflow-lang-pills">
                    {(["en", "vi"] as PlatformLocale[]).map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={locale === item ? "active" : ""}
                        aria-pressed={locale === item}
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
                {canManageCatalog && (
                  <button
                    type="button"
                    className="admin-overflow-item"
                    onClick={() => {
                      setOverflowOpen(false);
                      requestNavigation(() => onViewTabChange("settings"));
                    }}
                  >
                    <Settings2 size={15} />
                    <span>{t("Settings")}</span>
                  </button>
                )}
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
                <button
                  type="button"
                  className="admin-overflow-item admin-overflow-signout"
                  disabled={signOutBusy}
                  onClick={() => {
                    setOverflowOpen(false);
                    requestNavigation(onRequestSignOut);
                  }}
                >
                  <LogOut size={15} />
                  <span>{t("Sign out")}</span>
                </button>
              </div>
            )}
          </div>
        </>
      }
    />
  );
}
