import type { OrderStatusCounts } from "../../lib/api";
import { usePlatformI18n } from "../../lib/i18n/platformI18n";
import type {
  BoothSettings,
  Order,
  PaymentSettings,
  Product,
  PromotionSettings,
} from "../../types/catalog";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { GachaManager } from "./GachaManager";
import { OrderQueue } from "./OrderQueue";
import { QrManager } from "./QrManager";
import { SettingsForm } from "./SettingsForm";
import { StaffManager } from "./StaffManager";
import { StorefrontDesigner } from "./StorefrontDesigner";
import { AdminProductsWorkspace } from "./AdminProductsWorkspace";
import type { AdminViewTab } from "./adminWorkspaceTypes";
import { OfflineEventManager } from "./OfflineEventManager";
import type { OrderViewFilter } from "./OrderQueue";

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
  eventOrderCount: number;
  ordersTodayOnly: boolean;
  orderCounts: OrderStatusCounts;
  orderPage: number;
  orderPageSize: number;
  orderTotal: number;
  ordersLoading: boolean;
  onRetry: () => void;
  onOrderFilterChange: (filter: OrderViewFilter) => void;
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
  eventOrderCount,
  ordersTodayOnly,
  orderCounts,
  orderPage,
  orderPageSize,
  orderTotal,
  ordersLoading,
  onRetry,
  onOrderFilterChange,
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
        orders={orders}
        filter={orderFilter}
        todayOnly={ordersTodayOnly}
        counts={orderCounts}
        eventCount={eventOrderCount}
        eventControl={
          canManageCatalog ? (
            <OfflineEventManager
              shopId={shopId}
              shopSlug={shopSlug}
              products={products}
              booth={booth}
              payment={payment}
              promotion={promotion}
            />
          ) : undefined
        }
        page={orderPage}
        pageSize={orderPageSize}
        total={orderTotal}
        loading={ordersLoading}
        onFilterChange={onOrderFilterChange}
        onTodayOnlyChange={onOrdersTodayOnlyChange}
        onPageChange={onOrderPageChange}
        onOrderUpdated={onOrderUpdated}
      />
    );
  }

  if (!canManageCatalog) return null;

  if (viewTab === "products") {
    return (
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
    );
  }

  if (viewTab === "gacha") {
    return (
      <GachaManager shopId={shopId} shopSlug={shopSlug} products={products} />
    );
  }

  if (viewTab === "design") {
    return (
      <StorefrontDesigner
        shopId={shopId}
        settings={booth}
        products={products}
        payment={payment}
        onSave={onSaveBooth}
        onSavePayment={onSavePayment}
      />
    );
  }

  if (viewTab === "settings") {
    return (
      <section className="admin-mobile-settings-page">
        <SettingsForm shopId={shopId} settings={booth} onSave={onSaveBooth} />
        <QrManager shopId={shopId} settings={payment} onSave={onSavePayment} />
      </section>
    );
  }

  if (viewTab === "team" && canManageTeam) {
    return (
      <section className="admin-team-page">
        <StaffManager shopId={shopId} />
      </section>
    );
  }

  return null;
}
