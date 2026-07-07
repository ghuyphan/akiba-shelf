import type { Product } from "../../types/catalog";
import { formatVnd } from "../../lib/format";
import { Button } from "../ui/Button";
import { AdminCard } from "./AdminCard";
import { Boxes, ImageIcon, PackageSearch, Plus } from "lucide-react";

type ProductListProps = {
  products: Product[];
  selectedId?: string;
  onSelect: (product: Product) => void;
  onCreate: () => void;
};

export function ProductList({ products, selectedId, onSelect, onCreate }: ProductListProps) {
  return (
    <AdminCard
      title="Products"
      description={`${products.length} items`}
      icon={<Boxes size={18} />}
      className="product-manager-list"
      action={
        <Button icon={<Plus size={18} />} onClick={onCreate}>
          New Item
        </Button>
      }
    >
      <div className="admin-product-list">
        {products.length === 0 && (
          <div className="admin-list-empty">
            <PackageSearch size={24} />
            <strong>No products yet</strong>
            <span>Create the first catalog item to start building the booth.</span>
          </div>
        )}
        {products.map((product) => {
          const primaryImage = product.images.find(Boolean);

          return (
            <button
              key={product.id}
              type="button"
              className={product.id === selectedId ? "admin-product active" : "admin-product"}
              onClick={() => onSelect(product)}
            >
              <span className="admin-product-thumb">
                {primaryImage ? <img src={primaryImage} alt="" /> : <ImageIcon size={24} className="admin-product-thumb-placeholder" />}
              </span>
              <span>
                <strong>{product.name}</strong>
                <small>
                  {product.item_code} · {formatVnd(product.price_vnd)}
                </small>
              </span>
            </button>
          );
        })}
      </div>
    </AdminCard>
  );
}
