import { useEffect, useMemo, useState } from "react";
import "../../styles/admin/admin.css";
import { Navigate, useNavigate } from "react-router";
import { deleteProduct, saveProduct } from "../../lib/api/products";
import {
  saveBoothSettings,
  savePaymentSettings,
  savePromotionSettings,
} from "../../lib/api/settings";
import { signInAdmin, signOutAdmin } from "../../lib/api/auth";
import { getShopWorkspaceSummary } from "../../lib/api/shops";
import { defaultBooth, MAX_OWNED_SHOPS } from "../../lib/constants";
import { isSessionNoise } from "../../lib/errors";
import {
  applyAdminPageTheme,
  getAdminThemeStyle,
  resetPageTheme,
} from "../../utils/theme";
import { getAdminBranding, useDocumentBranding } from "../../lib/branding";
import type { Product } from "../../types/catalog";
import {
  AdminAccessCheck,
  AdminAccessDenied,
  LoginPanel,
} from "../../components/admin/auth/LoginPanel";
import { useToast } from "../../components/ui/ToastProvider";
import { useAdminSession } from "../../hooks/admin/useAdminSession";
import { usePlatformI18n } from "../../lib/i18n/platformI18n";
import { PwaInstallBanner } from "../../components/admin/shell/PwaInstallBanner";
import { getOfflineEventSignOutRisk } from "../../lib/offline/offlineEvents";
import { AdminWorkspaceHeader } from "../../components/admin/shell/AdminWorkspaceHeader";
import { AdminViewHero } from "../../components/admin/shell/AdminViewHero";
import { AdminAttentionPanel } from "../../components/admin/shell/AdminAttentionPanel";
import { AdminWorkspaceContent } from "../../components/admin/shell/AdminWorkspaceContent";
import {
  AdminGuideModal,
  type GuideSection,
} from "../../components/admin/shell/AdminGuideModal";
import { AdminUnsavedChangesProvider } from "../../components/admin/shell/AdminUnsavedChanges";
import { SignOutDialog } from "../../components/platform/SignOutDialog";
import { EventPinDialog } from "../../components/ui/EventPinDialog";
import { saveCatalogSnapshot } from "../../lib/offline/offline";
import { useMediaQuery } from "../../hooks/shared/useMediaQuery";
import { useAdminViewRoute } from "../../hooks/admin/useAdminViewRoute";
import { useAdminNotifications } from "../../hooks/admin/useAdminNotifications";
import { useAdminEventAccess } from "../../hooks/admin/useAdminEventAccess";
import { useAdminCatalogWorkspace } from "../../hooks/admin/useAdminCatalogWorkspace";
import { useAdminOrdersWorkspace } from "../../hooks/admin/useAdminOrdersWorkspace";

export function AdminPage() {
  const navigate = useNavigate();
  const {
    state: adminSession,
    refresh: refreshAdminSession,
    selectShop,
  } = useAdminSession();
  const isAuthed = adminSession.status === "authorized";
  const shopId = isAuthed ? adminSession.access.shop_id : "";
  const userId = isAuthed ? adminSession.userId : "";
  const canManageCatalog = isAuthed && adminSession.access.role !== "staff";
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [workspaceLoadFailed, setWorkspaceLoadFailed] = useState(false);
  const { viewTab, setViewTab } = useAdminViewRoute();
  const [isSignOutOpen, setIsSignOutOpen] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [guideSection, setGuideSection] = useState<GuideSection>("checklist");
  const {
    state: eventAccess,
    unlock: unlockEventAccess,
    verify: verifyEventPin,
  } = useAdminEventAccess(isAuthed, shopId);
  const {
    booth,
    catalogLoading,
    loadedShopId: loadedCatalogShopId,
    markLocalWrite,
    payment,
    products,
    promotion,
    reload: reloadCatalogAdmin,
    selectedProduct,
    setBooth,
    setPayment,
    setProducts,
    setPromotion,
    setSelectedProduct,
  } = useAdminCatalogWorkspace({ enabled: canManageCatalog, shopId });
  const {
    changeFilter: handleOrderFilterChange,
    changeTodayOnly: handleOrdersTodayOnlyChange,
    eventOrderCount,
    expiringOrderCount,
    openPending: handleOpenPendingOrders,
    orderCounts,
    orderFilter,
    orderPage,
    orderTotal,
    orders,
    ordersLoading,
    ordersTodayOnly,
    pageSize: orderPageSize,
    reload: reloadOrders,
    sales,
    scheduleReload: scheduleOrdersReload,
    selectEvent: handleSelectedEventChange,
    selectedEventId,
    setOrderPage,
  } = useAdminOrdersWorkspace({
    enabled: isAuthed,
    ready: isAuthed && !isInitialLoading,
    shopId,
    userId,
  });
  const toast = useToast();
  const { t } = usePlatformI18n();
  const compactAdminLayout = useMediaQuery("(max-width: 1100px)");

  const verifiedBranding =
    isAuthed && booth.shop_id === shopId && !isInitialLoading && !catalogLoading
      ? getAdminBranding(
          adminSession.access.shop_name,
          booth.booth_name,
          booth.logo_url,
          booth.theme_background,
        )
      : null;
  useDocumentBranding(verifiedBranding);

  const lowStockCount = useMemo(
    () =>
      products.filter(
        (product) => product.active && product.stock_status !== "in_stock",
      ).length,
    [products],
  );
  useEffect(() => {
    setWorkspaceLoadFailed(false);
    setIsInitialLoading(true);
  }, [shopId]);

  const { statuses: notificationStatuses, retry: handleRetryNotification } =
    useAdminNotifications({
      enabled: isAuthed && !isInitialLoading,
      shopId,
    });
  // Load initial workspace data in parallel before showing the admin panel
  useEffect(() => {
    if (!isAuthed) {
      setIsInitialLoading(true);
      return;
    }
    if (!isInitialLoading) return;

    let active = true;
    async function loadWorkspaceData() {
      try {
        if (canManageCatalog) {
          await Promise.all([reloadCatalogAdmin(), reloadOrders(true)]);
        } else {
          const [summary] = await Promise.all([
            getShopWorkspaceSummary(shopId),
            reloadOrders(true),
          ]);
          if (!active) return;
          setBooth({
            ...defaultBooth,
            shop_id: summary.id,
            booth_name: summary.booth_name,
            logo_url: summary.logo_url,
            theme_background: summary.theme_background,
          });
        }
        if (active) setWorkspaceLoadFailed(false);
      } catch (error) {
        if (!isSessionNoise(error)) {
          if (active) setWorkspaceLoadFailed(true);
          toast.error(
            t("Could not load workspace data."),
            t("Connection error"),
          );
        }
      } finally {
        if (active) {
          setIsInitialLoading(false);
        }
      }
    }

    void loadWorkspaceData();

    return () => {
      active = false;
    };
  }, [
    isAuthed,
    canManageCatalog,
    shopId,
    isInitialLoading,
    reloadCatalogAdmin,
    reloadOrders,
    setBooth,
    t,
    toast,
  ]);

  useEffect(() => {
    if (!canManageCatalog || isInitialLoading) return;
    if (loadedCatalogShopId === shopId) return;

    reloadCatalogAdmin().catch((error) => {
      if (isSessionNoise(error)) return;
      toast.error(
        t("Could not load the admin workspace."),
        t("Admin unavailable"),
      );
    });
  }, [
    canManageCatalog,
    isInitialLoading,
    loadedCatalogShopId,
    reloadCatalogAdmin,
    shopId,
    t,
    toast,
  ]);

  useEffect(() => {
    if (!isAuthed || !shopId) return;
    applyAdminPageTheme(booth, `id:${shopId}`);
    return () => resetPageTheme();
  }, [booth, isAuthed, shopId]);

  useEffect(() => {
    if (isAuthed && !canManageCatalog && viewTab !== "orders")
      setViewTab("orders", true);
  }, [isAuthed, canManageCatalog, setViewTab, viewTab]);
  useEffect(() => {
    if (isAuthed && viewTab === "team" && adminSession.access.role !== "owner")
      setViewTab("orders", true);
  }, [isAuthed, adminSession, setViewTab, viewTab]);

  async function handleLogin(
    email: string,
    password: string,
    captchaToken: string,
  ) {
    await signInAdmin(email, password, captchaToken);
    await refreshAdminSession();
  }

  async function handleSaveProduct(product: Product) {
    markLocalWrite();
    const saved = await saveProduct(shopId, product);
    markLocalWrite();
    await reloadCatalogAdmin();
    setSelectedProduct(saved.product);
    if (saved.imageCleanupPending) {
      toast.info(
        t(
          "The item was saved, but obsolete images could not be cleaned up yet.",
        ),
        t("Item saved with follow-up needed"),
      );
    } else {
      toast.success(t("Item saved."));
    }
  }

  async function handleDeleteProduct(id: string) {
    markLocalWrite();
    const { imageCleanupPending } = await deleteProduct(shopId, id);
    markLocalWrite();
    setSelectedProduct(undefined);
    const nextProducts = products.filter((product) => product.id !== id);
    setProducts(nextProducts);
    saveCatalogSnapshot(
      { booth, payment, promotion, products: nextProducts },
      shopId,
      { replaceProducts: true, complete: true },
    );
    const followUpNotices: string[] = [];
    if (imageCleanupPending) {
      followUpNotices.push(
        t(
          "The item was deleted, but its unused images could not be cleaned up.",
        ),
      );
    }
    try {
      await reloadCatalogAdmin();
    } catch {
      followUpNotices.push(
        t(
          "The item was deleted, but the catalog could not be refreshed. Reload to verify the latest list.",
        ),
      );
    }
    if (followUpNotices.length) {
      toast.info(
        followUpNotices.join(" "),
        t("Item deleted with follow-up needed"),
      );
    } else {
      toast.success(t("Item deleted."));
    }
  }

  async function handleSignOut() {
    setSignOutBusy(true);
    try {
      let offlineRisk: Awaited<ReturnType<typeof getOfflineEventSignOutRisk>>;
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

  if (
    adminSession.status === "checking" ||
    (adminSession.status === "authorized" &&
      (isInitialLoading || eventAccess.status === "checking"))
  ) {
    return <AdminAccessCheck />;
  }

  if (adminSession.status === "unauthenticated")
    return <LoginPanel onLogin={handleLogin} booth={booth} />;
  if (adminSession.status === "unauthorized") {
    return <Navigate to="/dashboard" replace />;
  }
  if (adminSession.status === "inactive") {
    return <AdminAccessDenied kind="inactive" onSignOut={handleSignOut} />;
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

  if (eventAccess.status === "locked") {
    return (
      <main
        className="event-admin-lock-screen"
        style={getAdminThemeStyle(booth)}
      >
        <div className="event-admin-lock-brand" aria-hidden="true">
          <span>M</span>
          <strong>Matsuri</strong>
        </div>
        <EventPinDialog
          isOpen
          mode="verify"
          copy={{
            title: t("Staff access locked"),
            message: t('Enter the local tablet PIN to manage "{{event}}".', {
              event: eventAccess.eventName,
            }),
            pinLabel: t("6-digit tablet PIN"),
            confirmPinLabel: t("Confirm tablet PIN"),
            cancelLabel: t("Back to storefront"),
            submitLabel: t("Open event console"),
            submittingLabel: t("Checking…"),
            invalidPin: t("Enter exactly 6 digits."),
            pinMismatch: t("The PINs do not match."),
            submitError: t("Could not check the tablet PIN on this device."),
            closeLabel: t("Back to storefront"),
          }}
          onClose={() =>
            navigate(
              `/s/${encodeURIComponent(adminSession.access.shop_slug)}`,
              { replace: true },
            )
          }
          onSubmit={async (pin) => {
            const result = await verifyEventPin(pin);
            if (!result.ok)
              return result.blockedUntil
                ? t("Too many attempts. Wait 30 seconds and try again.")
                : t("Incorrect tablet PIN.");
            unlockEventAccess();
          }}
        />
      </main>
    );
  }

  function handleOpenGuide(section: GuideSection = "checklist") {
    setGuideSection(section);
    setIsGuideOpen(true);
  }

  const canCreateShop =
    adminSession.memberships.filter((membership) => membership.role === "owner")
      .length < MAX_OWNED_SHOPS;
  return (
    <AdminUnsavedChangesProvider>
      <main className="admin-shell" style={getAdminThemeStyle(booth)}>
        <AdminWorkspaceHeader
          booth={booth}
          access={adminSession.access}
          memberships={adminSession.memberships}
          viewTab={viewTab}
          productsCount={products.length}
          pendingOrderCount={orderCounts.pending}
          canManageCatalog={canManageCatalog}
          canCreateShop={canCreateShop}
          signOutBusy={signOutBusy}
          onViewTabChange={setViewTab}
          onSelectShop={selectShop}
          onRequestSignOut={() => setIsSignOutOpen(true)}
          onOpenGuide={handleOpenGuide}
        />

        <div className="admin-container">
          <PwaInstallBanner />
          <AdminViewHero viewTab={viewTab} />
          {viewTab === "orders" && (
            <AdminAttentionPanel
              booth={booth}
              payment={payment}
              products={products}
              expiringOrderCount={expiringOrderCount}
              lowStockCount={lowStockCount}
              notificationStatuses={notificationStatuses}
              canManageCatalog={canManageCatalog}
              canRetryNotifications={adminSession.access.role !== "staff"}
              onOpenOrders={handleOpenPendingOrders}
              onOpenProducts={() => setViewTab("products")}
              onOpenSettings={() =>
                setViewTab(compactAdminLayout ? "settings" : "design")
              }
              onRetryNotification={handleRetryNotification}
              onOpenGuide={handleOpenGuide}
            />
          )}
          <AdminWorkspaceContent
            viewTab={viewTab}
            shopId={shopId}
            shopSlug={adminSession.access.shop_slug}
            canManageCatalog={canManageCatalog}
            canManageTeam={adminSession.access.role === "owner"}
            workspaceLoadFailed={workspaceLoadFailed}
            products={products}
            selectedProduct={selectedProduct}
            catalogLoading={catalogLoading}
            booth={booth}
            payment={payment}
            promotion={promotion}
            orders={orders}
            orderFilter={orderFilter}
            selectedEventId={selectedEventId}
            eventOrderCount={eventOrderCount}
            ordersTodayOnly={ordersTodayOnly}
            orderCounts={orderCounts}
            orderPage={orderPage}
            orderPageSize={orderPageSize}
            orderTotal={orderTotal}
            ordersLoading={ordersLoading}
            sales={sales}
            onRetry={() => {
              setWorkspaceLoadFailed(false);
              setIsInitialLoading(true);
            }}
            onOrderFilterChange={handleOrderFilterChange}
            onSelectedEventChange={handleSelectedEventChange}
            onOrdersTodayOnlyChange={handleOrdersTodayOnlyChange}
            onOrderPageChange={setOrderPage}
            onOrderUpdated={scheduleOrdersReload}
            onSelectProduct={setSelectedProduct}
            onSaveProduct={handleSaveProduct}
            onDeleteProduct={handleDeleteProduct}
            onSavePromotion={async (nextPromotion) => {
              markLocalWrite();
              const saved = await savePromotionSettings(shopId, nextPromotion);
              markLocalWrite();
              setPromotion(saved);
              toast.success(t("Promotion saved."));
            }}
            onSaveBooth={async (settings) => {
              markLocalWrite();
              const saved = await saveBoothSettings(shopId, settings);
              markLocalWrite();
              setBooth(saved.booth);
              if (saved.imageCleanupPending) {
                toast.info(
                  t(
                    "The storefront was saved, but obsolete images could not be cleaned up yet.",
                  ),
                  t("Storefront saved with follow-up needed"),
                );
              } else {
                toast.success(
                  t(
                    viewTab === "design"
                      ? "Storefront design published."
                      : "Booth settings saved.",
                  ),
                );
              }
            }}
            onSavePayment={async (settings) => {
              markLocalWrite();
              const saved = await savePaymentSettings(shopId, settings);
              markLocalWrite();
              setPayment(saved);
              toast.success(t("Checkout settings saved."));
            }}
          />
        </div>

        <AdminGuideModal
          isOpen={isGuideOpen}
          onClose={() => setIsGuideOpen(false)}
          booth={booth}
          payment={payment}
          products={products}
          shopRole={adminSession.access.role}
          shopSlug={adminSession.access.shop_slug}
          onNavigateTab={setViewTab}
          initialSection={guideSection}
        />

        <SignOutDialog
          isOpen={isSignOutOpen}
          busy={signOutBusy}
          title={t("Sign out of admin?")}
          heading={t("Your work is saved.")}
          message={t(
            "You’ll return to the staff login screen. The public catalog stays open for customers.",
          )}
          cancelLabel={t("Stay signed in")}
          confirmLabel={t("Sign out")}
          loadingLabel={t("Signing out…")}
          onClose={() => setIsSignOutOpen(false)}
          onConfirm={() => void handleSignOut()}
        />
      </main>
    </AdminUnsavedChangesProvider>
  );
}
