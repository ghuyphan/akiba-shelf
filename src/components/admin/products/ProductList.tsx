import { useMemo, useState } from "react";
import type { Product } from "../../../types/catalog";
import { formatVnd } from "../../../utils/format";
import { getProductPrice, isProductOnSale } from "../../../utils/pricing";
import { AdminCard } from "../shell/AdminCard";
import { Boxes, ImageIcon, PackageSearch, Plus, RotateCcw, Search } from "lucide-react";
import { EmptyState } from "../../ui/EmptyState";
import { Button } from "../../ui/Button";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";

type ProductListProps = {
  products: Product[];
  selectedId?: string;
  onSelect: (product: Product) => void;
  onCreate: () => void;
  loading?: boolean;
};

export function ProductList({ products, selectedId, onSelect, onCreate, loading = false }: ProductListProps) {
  const { t } = usePlatformI18n();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "live" | "low" | "hidden">("all");
  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery = !normalizedQuery || [product.name, product.item_code, product.collection, product.category].some((value) => value?.toLowerCase().includes(normalizedQuery));
      const matchesFilter = filter === "all" || (filter === "live" && product.active && product.quantity_available > 5) || (filter === "low" && product.active && product.quantity_available <= 5) || (filter === "hidden" && !product.active);
      return matchesQuery && matchesFilter;
    });
  }, [filter, products, query]);

  return (
    <AdminCard title={t("Products")} description={t("{{count}} catalog items", { count: products.length })} icon={<Boxes size={18} />} className="product-manager-list">
      <div className="admin-list-toolbar">
        <label className="admin-list-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Search products")} aria-label={t("Search products")} /></label>
        <button type="button" className="admin-new-item-button" onClick={onCreate}><Plus size={17} /> {t("New item")}</button>
      </div>
      <div className="admin-list-filters" aria-label={t("Product filters")}>
        {(["all", "live", "low", "hidden"] as const).map((item) => <button key={item} type="button" className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{t(item === "low" ? "Low / sold out" : item)}</button>)}
      </div>
      <div className="admin-product-list admin-scroll-list">
        {visibleProducts.length === 0 && (
          <EmptyState
            variant="compact"
            tone={loading ? "loading" : "neutral"}
            icon={loading ? undefined : <PackageSearch size={25} />}
            title={loading ? t("Loading products…") : products.length === 0 ? t("No products yet") : t("No matching products")}
            message={loading ? t("Fetching the latest catalog and stock levels.") : products.length === 0 ? t("Create your first item to start filling the booth.") : t("Adjust your search or return to all products.")}
            action={!loading && products.length === 0
              ? <Button type="button" icon={<Plus size={16} />} onClick={onCreate}>{t("Create product")}</Button>
              : !loading ? <Button type="button" variant="secondary" icon={<RotateCcw size={16} />} onClick={() => { setQuery(""); setFilter("all"); }}>{t("Clear filters")}</Button> : undefined}
          />
        )}
        {visibleProducts.map((product) => {
          const primaryImage = product.images.find(Boolean);
          const stockTone = product.quantity_available <= 0 ? "soldout" : product.quantity_available <= 5 ? "low" : "live";
          return (
            <button key={product.id} type="button" className={product.id === selectedId ? "admin-product active" : "admin-product"} onClick={() => onSelect(product)}>
              <span className="admin-product-thumb">{primaryImage ? <img src={primaryImage} alt="" /> : <ImageIcon size={24} className="admin-product-thumb-placeholder" />}</span>
              <span className="admin-product-copy">
                <span className="admin-product-title-row"><strong>{product.name || t("Untitled item")}</strong>{product.featured && <span className="admin-status-pill featured">{t("Featured")}</span>}{!product.active && <span className="admin-status-pill hidden">{t("Hidden")}</span>}</span>
                <small>{product.item_code || t("No code")} · {formatVnd(getProductPrice(product))}{isProductOnSale(product) ? ` · ${t("Sale")}` : ""}</small>
                <span className={`admin-stock-pill ${stockTone}`}><i />{product.quantity_available <= 0 ? t("Sold out") : t("{{count}} in stock", { count: product.quantity_available })}</span>
              </span>
            </button>
          );
        })}
      </div>
    </AdminCard>
  );
}
