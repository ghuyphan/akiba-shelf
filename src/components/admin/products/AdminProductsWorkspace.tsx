import { useMemo, useState } from "react";
import { Package } from "lucide-react";
import { useTabIndicator } from "../../../hooks/shared/useTabIndicator";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";
import { safeUuid } from "../../../utils/id";
import type { Product, PromotionSettings } from "../../../types/catalog";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { ProductForm } from "./ProductForm";
import { ProductList } from "./ProductList";
import { PromotionSettingsForm } from "../settings/PromotionSettingsForm";
import type { ProductWorkspaceTab } from "../shell/adminWorkspaceTypes";
import { useAdminNavigationGuard } from "../shell/AdminUnsavedChanges";
import { useMediaQuery } from "../../../hooks/shared/useMediaQuery";

type AdminProductsWorkspaceProps = {
  shopId: string;
  products: Product[];
  promotion: PromotionSettings;
  selectedProduct?: Product;
  loading: boolean;
  onSelectProduct: (product: Product) => void;
  onSaveProduct: (product: Product) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
  onSavePromotion: (promotion: PromotionSettings) => Promise<void>;
};

function createBlankProduct(nextSort: number): Product {
  return {
    id: safeUuid(),
    name: "",
    collection: "",
    description: "",
    price_vnd: 0,
    sale_price_vnd: null,
    promotion_eligible: false,
    item_code: "",
    quantity_available: 0,
    category: "Acrylic",
    badge: "",
    badge_color: "#5f8d55",
    stock_status: "in_stock",
    stock_note: "In stock",
    images: [""],
    featured: false,
    sort_order: nextSort,
    active: true,
  };
}

export function AdminProductsWorkspace({
  shopId,
  products,
  promotion,
  selectedProduct,
  loading,
  onSelectProduct,
  onSaveProduct,
  onDeleteProduct,
  onSavePromotion,
}: AdminProductsWorkspaceProps) {
  const { t } = usePlatformI18n();
  const requestNavigation = useAdminNavigationGuard();
  const singlePanelLayout = useMediaQuery("(max-width: 1100px)");
  const [activeTab, setActiveTab] = useState<ProductWorkspaceTab>("list");
  const { containerRef, registerItem } = useTabIndicator<
    ProductWorkspaceTab,
    HTMLDivElement
  >(activeTab, [products.length]);
  const nextSort = useMemo(
    () => Math.max(0, ...products.map((product) => product.sort_order)) + 1,
    [products],
  );
  const featuredCount = useMemo(
    () => products.filter((product) => product.featured).length,
    [products],
  );

  function focusWorkspaceTab(next: ProductWorkspaceTab) {
    window.requestAnimationFrame(() => {
      document.getElementById(`product-workspace-${next}-tab`)?.focus();
    });
  }

  function createProduct() {
    requestNavigation(() => {
      onSelectProduct(createBlankProduct(nextSort));
      setActiveTab("form");
      focusWorkspaceTab("form");
    });
  }

  function activateTab(next: ProductWorkspaceTab) {
    if (next === activeTab) return;
    requestNavigation(() => {
      setActiveTab(next);
      focusWorkspaceTab(next);
    });
  }

  return (
    <>
      <PromotionSettingsForm
        key={shopId}
        promotion={promotion}
        products={products}
        onSave={onSavePromotion}
      />
      <div
        className="admin-mobile-tabs-row admin-segmented-control admin-segmented-tabs"
        ref={containerRef}
        role={singlePanelLayout ? "tablist" : undefined}
        aria-label={singlePanelLayout ? t("Product workspace") : undefined}
      >
        <button
          type="button"
          id="product-workspace-list-tab"
          role={singlePanelLayout ? "tab" : undefined}
          aria-controls={
            singlePanelLayout ? "product-workspace-list-panel" : undefined
          }
          aria-selected={singlePanelLayout ? activeTab === "list" : undefined}
          tabIndex={
            singlePanelLayout ? (activeTab === "list" ? 0 : -1) : undefined
          }
          ref={registerItem("list")}
          className={`admin-workspace-tab ${activeTab === "list" ? "is-active" : ""}`}
          onClick={() => activateTab("list")}
          onKeyDown={(event) => {
            if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
            event.preventDefault();
            const next = activeTab === "list" ? "form" : "list";
            activateTab(next);
          }}
        >
          {t("Products ({{count}})", { count: products.length })}
        </button>
        <button
          type="button"
          id="product-workspace-form-tab"
          role={singlePanelLayout ? "tab" : undefined}
          aria-controls={
            singlePanelLayout ? "product-workspace-form-panel" : undefined
          }
          aria-selected={singlePanelLayout ? activeTab === "form" : undefined}
          tabIndex={
            singlePanelLayout ? (activeTab === "form" ? 0 : -1) : undefined
          }
          ref={registerItem("form")}
          className={`admin-workspace-tab ${activeTab === "form" ? "is-active" : ""}`}
          onClick={() => activateTab("form")}
          onKeyDown={(event) => {
            if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
            event.preventDefault();
            const next = activeTab === "list" ? "form" : "list";
            activateTab(next);
          }}
        >
          {t("Edit product")}
        </button>
      </div>
      <div className="admin-grid">
        <div
          id="product-workspace-list-panel"
          role={singlePanelLayout ? "tabpanel" : undefined}
          aria-labelledby={
            singlePanelLayout ? "product-workspace-list-tab" : undefined
          }
          className={`admin-grid-col-list ${activeTab === "list" ? "show" : "hide"}`}
        >
          <ProductList
            products={products}
            selectedId={selectedProduct?.id}
            onSelect={(product) => {
              if (product.id === selectedProduct?.id) {
                setActiveTab("form");
                focusWorkspaceTab("form");
                return;
              }
              requestNavigation(() => {
                onSelectProduct(product);
                setActiveTab("form");
                focusWorkspaceTab("form");
              });
            }}
            onCreate={createProduct}
            loading={loading}
          />
        </div>
        {selectedProduct ? (
          <div
            id="product-workspace-form-panel"
            role={singlePanelLayout ? "tabpanel" : undefined}
            aria-labelledby={
              singlePanelLayout ? "product-workspace-form-tab" : undefined
            }
            className={`admin-grid-col-form ${activeTab === "form" ? "show" : "hide"}`}
          >
            <ProductForm
              key={selectedProduct.id}
              shopId={shopId}
              product={selectedProduct}
              featuredCount={featuredCount}
              onSave={onSaveProduct}
              onDelete={onDeleteProduct}
            />
          </div>
        ) : (
          <div
            id="product-workspace-form-panel"
            role={singlePanelLayout ? "tabpanel" : undefined}
            aria-labelledby={
              singlePanelLayout ? "product-workspace-form-tab" : undefined
            }
            className={`admin-grid-col-form admin-form-empty ${activeTab === "form" ? "show" : "hide"}`}
          >
            <EmptyState
              variant="compact"
              icon={<Package size={26} />}
              title={t("No product selected")}
              message={t(
                "Choose a product from the list to edit it, or start a fresh listing.",
              )}
              action={
                <Button icon={<Package size={16} />} onClick={createProduct}>
                  {t("Create product")}
                </Button>
              }
            />
          </div>
        )}
      </div>
    </>
  );
}
