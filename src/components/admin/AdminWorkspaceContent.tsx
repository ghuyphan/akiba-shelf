import { Suspense } from "react";
import type { OrderStatusCounts } from "../../lib/api/orders";
import { usePlatformI18n } from "../../lib/i18n/platformI18n";
import { lazyWithRetry } from "../../utils/lazyWithRetry";
import type {
  BoothSettings,
  Order,
  PaymentSettings,
  Product,
  PromotionSettings,
} from "../../types/catalog";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { OrderQueue } from "./OrderQueue";
import type { AdminViewTab } from "./adminWorkspaceTypes";
import type { OrderViewFilter } from "./OrderQueue";

const AdminProductsWorkspace = lazyWithRetry("admin-products-workspace", () =>
  import("./AdminProductsWorkspace").then((module) => ({
    default: module.AdminProductsWorkspace,
  })),
);
const GachaManager = lazyWithRetry("admin-gacha-workspace", () =>
  import("./GachaManager").then((module) => ({ default: module.GachaManager })),
);
const StorefrontDesigner = lazyWithRetry("admin-design-workspace", () =>
  import("./StorefrontDesigner").then((module) => ({
    default: module.StorefrontDesigner,
  })),
);
const SettingsForm = lazyWithRetry("admin-settings-form", () =>
  import("./SettingsForm").then((module) => ({ default: module.SettingsForm })),
);
const QrManager = lazyWithRetry("admin-qr-manager", () =>
  import("./QrManager").then((module) => ({ default: module.QrManager })),
);
const StaffManager = lazyWithRetry("admin-team-workspace", () =>
  import("./StaffManager").then((module) => ({ default: module.StaffManager })),
);
const OfflineEventManager = lazyWithRetry("admin-offline-event-manager", () =>
  import("./OfflineEventManager").then((module) => ({
    default: module.OfflineEventManager,
  })),
);

type AdminWorkspaceContentProps = {
  viewTab: AdminViewTab;
  shopId: string;
  shopSlug: string;
  canManageCatalog: boolean;
  canManageTeam: boolean;
  workspaceLoadFailed: boolean;
  products: Product[];
  selectedProduct?: Product;
  catalogLoading: boolean;
  booth: BoothSettings;
  payment: PaymentSettings;
  promotion: PromotionSettings;
  orders: Order[];
  orderFilter: OrderViewFilter;
  selectedEventId: string;
  eventOrderCount: number;
  ordersTodayOnly: boolean;
  orderCounts: OrderStatusCounts;
  orderPage: number;
  orderPageSize: number;
  orderTotal: number;
  ordersLoading: boolean;
  onRetry: () => void;
  onOrderFilterChange: (filter: OrderViewFilter) => void;
  onSelectedEventChange: (eventId: string) => void;
  onOrdersTodayOnlyChange: (todayOnly: boolean) => void;
  onOrderPageChange: (page: number) => void;
  onOrderUpdated: () => void;
  onSelectProduct: (product: Product) => void;
  onSaveProduct: (product: Product) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
  onSavePromotion: (promotion: PromotionSettings) => Promise<void>;
  onSaveBooth: (settings: BoothSettings) => Promise<void>;
  onSavePayment: (settings: PaymentSettings) => Promise<void>;
};

export function AdminWorkspaceContent({
  viewTab,
  shopId,
  shopSlug,
  canManageCatalog,
  canManageTeam,
  workspaceLoadFailed,
  products,
  selectedProduct,
  catalogLoading,
  booth,
  payment,
  promotion,
  orders,
  orderFilter,
  selectedEventId,
  eventOrderCount,
  ordersTodayOnly,
  orderCounts,
  orderPage,
  orderPageSize,
  orderTotal,
  ordersLoading,
  onRetry,
  onOrderFilterChange,
  onSelectedEventChange,
  onOrdersTodayOnlyChange,
  onOrderPageChange,
  onOrderUpdated,
  onSelectProduct,
  onSaveProduct,
  onDeleteProduct,
  onSavePromotion,
  onSaveBooth,
  onSavePayment,
}: AdminWorkspaceContentProps) {
  const { t } = usePlatformI18n();
  const workspaceFallback = (
    <EmptyState
      tone="loading"
      title={t("Loading")}
      message={t("Loading your workspace…")}
    />
  );

  if (workspaceLoadFailed) {
    return (
      <EmptyState
        tone="error"
        title={t("Workspace unavailable")}
        message={t(
          "We could not load this shop's workspace. Check your connection and retry.",
        )}
        action={<Button onClick={onRetry}>{t("Retry loading")}</Button>}
      />
    );
  }

  if (viewTab === "orders") {
    return (
      <OrderQueue
        shopId={shopId}
        orders={orders}
        filter={orderFilter}
        selectedEventId={selectedEventId}
        todayOnly={ordersTodayOnly}
        counts={orderCounts}
        eventCount={eventOrderCount}
        eventControl={
          canManageCatalog ? (
            <Suspense fallback={workspaceFallback}>
              <OfflineEventManager
                shopId={shopId}
                shopSlug={shopSlug}
                products={products}
                booth={booth}
                payment={payment}
                promotion={promotion}
              />
            </Suspense>
          ) : undefined
        }
        page={orderPage}
        pageSize={orderPageSize}
        total={orderTotal}
        loading={ordersLoading}
        onFilterChange={onOrderFilterChange}
        onSelectedEventChange={onSelectedEventChange}
        onTodayOnlyChange={onOrdersTodayOnlyChange}
        onPageChange={onOrderPageChange}
        onOrderUpdated={onOrderUpdated}
      />
    );
  }

  if (!canManageCatalog) return null;

  if (viewTab === "products") {
    return (
      <Suspense fallback={workspaceFallback}>
        <AdminProductsWorkspace
          shopId={shopId}
          products={products}
          promotion={promotion}
          selectedProduct={selectedProduct}
          loading={catalogLoading}
          onSelectProduct={onSelectProduct}
          onSaveProduct={onSaveProduct}
          onDeleteProduct={onDeleteProduct}
          onSavePromotion={onSavePromotion}
        />
      </Suspense>
    );
  }

  if (viewTab === "gacha") {
    return (
      <Suspense fallback={workspaceFallback}>
        <GachaManager shopId={shopId} shopSlug={shopSlug} products={products} />
      </Suspense>
    );
  }

  if (viewTab === "design") {
    return (
      <Suspense fallback={workspaceFallback}>
        <StorefrontDesigner
          shopId={shopId}
          settings={booth}
          products={products}
          payment={payment}
          onSave={onSaveBooth}
          onSavePayment={onSavePayment}
        />
      </Suspense>
    );
  }

  if (viewTab === "settings") {
    return (
      <Suspense fallback={workspaceFallback}>
        <section className="admin-mobile-settings-page">
          <SettingsForm shopId={shopId} settings={booth} onSave={onSaveBooth} />
          <QrManager shopId={shopId} settings={payment} onSave={onSavePayment} />
        </section>
      </Suspense>
    );
  }

  if (viewTab === "team" && canManageTeam) {
    return (
      <Suspense fallback={workspaceFallback}>
        <section className="admin-team-page">
          <StaffManager shopId={shopId} />
        </section>
      </Suspense>
    );
  }

  return null;
}
