import { useMemo, useState } from "react";
import type { Product } from "../../types/catalog";
import { formatVnd } from "../../lib/format";
import { AdminCard } from "./AdminCard";
import { Boxes, ImageIcon, PackageSearch, Plus, RotateCcw, Search } from "lucide-react";
import { EmptyState } from "../ui/EmptyState";
import { Button } from "../ui/Button";

type ProductListProps = {
  products: Product[];
  selectedId?: string;
  onSelect: (product: Product) => void;
  onCreate: () => void;
};

export function ProductList({ products, selectedId, onSelect, onCreate }: ProductListProps) {
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
    <AdminCard title="Products" description={`${products.length} catalog items`} icon={<Boxes size={18} />} className="product-manager-list">
      <div className="admin-list-toolbar">
        <label className="admin-list-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" aria-label="Search products" /></label>
        <button type="button" className="admin-new-item-button" onClick={onCreate}><Plus size={17} /> New item</button>
      </div>
      <div className="admin-list-filters" aria-label="Product filters">
        {(["all", "live", "low", "hidden"] as const).map((item) => <button key={item} type="button" className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "low" ? "Low / sold out" : item}</button>)}
      </div>
      <div className="admin-product-list">
        {visibleProducts.length === 0 && (
          <EmptyState
            variant="compact"
            icon={<PackageSearch size={25} />}
            title={products.length === 0 ? "No products yet" : "No matching products"}
            message={products.length === 0 ? "Create your first item to start filling the booth." : "Adjust your search or return to all products."}
            action={products.length === 0
              ? <Button type="button" icon={<Plus size={16} />} onClick={onCreate}>Create product</Button>
              : <Button type="button" variant="secondary" icon={<RotateCcw size={16} />} onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</Button>}
          />
        )}
        {visibleProducts.map((product) => {
          const primaryImage = product.images.find(Boolean);
          const stockTone = product.quantity_available <= 0 ? "soldout" : product.quantity_available <= 5 ? "low" : "live";
          return (
            <button key={product.id} type="button" className={product.id === selectedId ? "admin-product active" : "admin-product"} onClick={() => onSelect(product)}>
              <span className="admin-product-thumb">{primaryImage ? <img src={primaryImage} alt="" /> : <ImageIcon size={24} className="admin-product-thumb-placeholder" />}</span>
              <span className="admin-product-copy">
                <span className="admin-product-title-row"><strong>{product.name || "Untitled item"}</strong>{product.featured && <span className="admin-status-pill featured">Featured</span>}{!product.active && <span className="admin-status-pill hidden">Hidden</span>}</span>
                <small>{product.item_code || "No code"} · {formatVnd(product.price_vnd)}</small>
                <span className={`admin-stock-pill ${stockTone}`}><i />{product.quantity_available <= 0 ? "Sold out" : `${product.quantity_available} in stock`}</span>
              </span>
            </button>
          );
        })}
      </div>
    </AdminCard>
  );
}
