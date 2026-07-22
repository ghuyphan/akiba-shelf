import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, LogOut, MailCheck } from "lucide-react";
import { PLATFORM_BRAND } from "../lib/branding";
import { AppHeader } from "../components/ui/AppHeader";
import { PlatformHeaderBrand } from "../components/ui/PlatformHeaderBrand";
import { SignOutDialog } from "../components/ui/SignOutDialog";
import { useAdminSession } from "../hooks/useAdminSession";
import { signInAdmin, signOutAdmin } from "../lib/api";
import {
  AdminAccessCheck,
  AdminAccessDenied,
  LoginPanel,
} from "../components/admin/LoginPanel";
import { useToast } from "../components/ui/ToastProvider";
import type { ShopMembership } from "../types/catalog";
import "../styles/admin.css";
import { usePlatformI18n } from "../lib/i18n/platformI18n";
import { PlatformLanguageToggle } from "../components/ui/PlatformLanguageToggle";
import { MAX_OWNED_SHOPS } from "../lib/constants";
import { PwaInstallBanner } from "../components/admin/PwaInstallBanner";
import { DashboardShopCard } from "../components/admin/dashboard/DashboardShopCard";
import { DashboardEditShopDialog } from "../components/admin/dashboard/DashboardEditShopDialog";
import { getOfflineEventSignOutRisk } from "../lib/offline/offlineEvents";

export function DashboardPage() {
  const { state: adminSession, refresh: refreshAdminSession } =
    useAdminSession();
  const navigate = useNavigate();
  const [isSignOutOpen, setIsSignOutOpen] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const toast = useToast();
  const { t } = usePlatformI18n();

  const [editingShop, setEditingShop] = useState<ShopMembership | null>(null);

  async function handleLogin(email: string, password: string) {
    await signInAdmin(email, password);
    await refreshAdminSession();
  }

  async function handleSignOut() {
    setSignOutBusy(true);
    try {
      let offlineRisk: Awaited<
        ReturnType<typeof getOfflineEventSignOutRisk>
      >;
      try {
        offlineRisk = await getOfflineEventSignOutRisk();
      } catch {
        toast.error(
          t(
            "Offline Event storage could not be checked. Keep this account signed in and retry after storage access is restored.",
          ),
          t("Sign-out safety check failed"),
        );
        return;
      }
      if (offlineRisk) {
        toast.error(
          t(
            "This device still owns event stock or unsynced orders. Sync and close Offline Event Mode before signing out.",
          ),
          t("Offline Event Mode is still active"),
        );
        return;
      }
      await signOutAdmin();
      setIsSignOutOpen(false);
      await refreshAdminSession();
    } catch {
      toast.error(
        t("Check your connection and try again."),
        t("Could not sign out"),
      );
    } finally {
      setSignOutBusy(false);
    }
  }

  function handleSelectShop(shopId: string) {
    localStorage.setItem("akiba-active-shop", shopId);
    navigate("/admin");
  }

  if (adminSession.status === "checking") {
    return <AdminAccessCheck />;
  }

  if (adminSession.status === "unauthenticated") {
    return <LoginPanel onLogin={handleLogin} />;
  }

  if (adminSession.status === "error") {
    return (
      <AdminAccessDenied
        kind="error"
        message={adminSession.message}
        onRetry={refreshAdminSession}
        onSignOut={handleSignOut}
      />
    );
  }

  if (
    adminSession.status !== "authorized" &&
    adminSession.status !== "inactive" &&
    adminSession.status !== "unauthorized"
  ) {
    return null;
  }

  const memberships =
    adminSession.status === "unauthorized" ? [] : adminSession.memberships;
  const ownedShopCount = memberships.filter(
    (shop) => shop.role === "owner",
  ).length;
  const joinedShopCount = memberships.length - ownedShopCount;
  const canCreateShop = ownedShopCount < MAX_OWNED_SHOPS;

  return (
    <div className="admin-shell">
      <AppHeader
        brand={
          <PlatformHeaderBrand
            backTo="/"
            backLabel={t("Back to home")}
            subtitle={t(PLATFORM_BRAND.descriptor)}
          />
        }
        actions={
          <>
            {adminSession.email && (
              <span className="dashboard-user-email">{adminSession.email}</span>
            )}
            <PlatformLanguageToggle />
            <button
              type="button"
              disabled={signOutBusy}
              onClick={() => setIsSignOutOpen(true)}
              className="app-header-button admin-signout-button"
            >
              <LogOut size={15} />
              <span>{t("Sign out")}</span>
            </button>
          </>
        }
      />

      <main className="admin-container">
        <PwaInstallBanner />
        <section className="admin-view-hero">
          <div>
            <span>{t("Your Account")}</span>
            <h1>
              {t(memberships.length ? "Your shops" : "Welcome to Matsuri")}
            </h1>
            <p>
              {t(
                memberships.length
                  ? "Select a shop workspace to manage orders, products, and designs, or preview its public storefront."
                  : "You can join a shop as a teammate or create your own storefront whenever you are ready.",
              )}
            </p>
            {memberships.length > 0 && (
              <div className="dashboard-shop-capacity" role="status">
                <strong>
                  {t("{{owned}} of {{limit}} created shops used", {
                    owned: ownedShopCount,
                    limit: MAX_OWNED_SHOPS,
                  })}
                </strong>
                <span>
                  {t(
                    "You have joined {{joined}} shops. Joined shops do not count toward this limit.",
                    { joined: joinedShopCount },
                  )}
                </span>
              </div>
            )}
          </div>
        </section>

        <div className="dashboard-grid">
          {!memberships.length && (
            <section className="dashboard-empty-welcome">
              <span>
                <MailCheck size={22} />
              </span>
              <div>
                <h2>{t("Joining someone else’s shop?")}</h2>
                <p>
                  {t(
                    "Open the invitation link from your email. After you accept it, the shop will appear here automatically.",
                  )}
                </p>
              </div>
            </section>
          )}
          {memberships.map((shop) => (
            <DashboardShopCard
              key={shop.shop_id}
              shop={shop}
              onManage={handleSelectShop}
              onEdit={setEditingShop}
            />
          ))}

          {canCreateShop ? (
            <Link to="/dashboard/shops/new" className="dashboard-create-card">
              <div className="create-card-content">
                <span className="create-card-plus">
                  <Plus size={24} />
                </span>
                <h3>
                  {t(
                    memberships.length
                      ? "Create another shop"
                      : "Create your own shop (optional)",
                  )}
                </h3>
                <p>
                  {t(
                    memberships.length
                      ? "Add a new storefront and manage its inventory, custom design, and orders."
                      : "Start a storefront only if you plan to sell your own merch. You can also wait for an invitation.",
                  )}
                </p>
              </div>
            </Link>
          ) : (
            <div
              className="dashboard-create-card is-disabled"
              aria-disabled="true"
            >
              <div className="create-card-content">
                <span className="create-card-plus">
                  <Plus size={24} />
                </span>
                <h3>{t("Shop creation limit reached")}</h3>
                <p>
                  {t(
                    "You can create up to {{limit}} shops. Joined shops do not count toward this limit.",
                    { limit: MAX_OWNED_SHOPS },
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      <SignOutDialog
        isOpen={isSignOutOpen}
        busy={signOutBusy}
        title={t("Sign out of your account?")}
        heading={t("Your work is saved.")}
        message={t("You’ll sign out of the platform dashboard and all shops.")}
        cancelLabel={t("Cancel")}
        confirmLabel={t("Sign out")}
        loadingLabel={t("Signing out…")}
        onClose={() => setIsSignOutOpen(false)}
        onConfirm={() => void handleSignOut()}
      />

      <DashboardEditShopDialog
        shop={editingShop}
        onClose={() => setEditingShop(null)}
        onSaved={refreshAdminSession}
      />
    </div>
  );
}
