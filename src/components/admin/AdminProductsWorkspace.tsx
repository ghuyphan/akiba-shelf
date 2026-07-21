import { useMemo, useState } from "react";
import { Package } from "lucide-react";
import { useTabIndicator } from "../../hooks/useTabIndicator";
import { usePlatformI18n } from "../../lib/i18n/platformI18n";
import { safeUuid } from "../../utils/id";
import type { Product, PromotionSettings } from "../../types/catalog";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { ProductForm } from "./ProductForm";
import { ProductList } from "./ProductList";
import { PromotionSettingsForm } from "./PromotionSettingsForm";
import type { ProductWorkspaceTab } from "./adminWorkspaceTypes";

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
  const [activeTab, setActiveTab] = useState<ProductWorkspaceTab>("list");
  const { containerRef, registerItem } = useTabIndicator<
    ProductWorkspaceTab,
    HTMLDivElement
  >(activeTab, [products.length]);
  const nextSort = useMemo(
    () => Math.max(0, ...products.map((product) => product.sort_order)) + 1,
    [products],
  );

  function createProduct() {
    onSelectProduct(createBlankProduct(nextSort));
    setActiveTab("form");
  }

  return (
    <>
      <PromotionSettingsForm
        promotion={promotion}
        products={products}
        onSave={onSavePromotion}
      />
      <div className="category-row admin-mobile-tabs-row" ref={containerRef}>
        <button
          type="button"
          ref={registerItem("list")}
          className={`chip ${activeTab === "list" ? "chip-active" : ""}`}
          onClick={() => setActiveTab("list")}
        >
          {t("Products List ({{count}})", { count: products.length })}
        </button>
        <button
          type="button"
          ref={registerItem("form")}
          className={`chip ${activeTab === "form" ? "chip-active" : ""}`}
          onClick={() => setActiveTab("form")}
        >
          {t("Edit Product")}
        </button>
      </div>
      <div className="admin-grid">
        <div
          className={`admin-grid-col-list ${activeTab === "list" ? "show" : "hide"}`}
        >
          <ProductList
            products={products}
            selectedId={selectedProduct?.id}
            onSelect={(product) => {
              onSelectProduct(product);
              setActiveTab("form");
            }}
            onCreate={createProduct}
            loading={loading}
          />
        </div>
        {selectedProduct ? (
          <div
            className={`admin-grid-col-form ${activeTab === "form" ? "show" : "hide"}`}
          >
            <ProductForm
              shopId={shopId}
              product={selectedProduct}
              onSave={onSaveProduct}
              onDelete={onDeleteProduct}
            />
          </div>
        ) : (
          <div
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
