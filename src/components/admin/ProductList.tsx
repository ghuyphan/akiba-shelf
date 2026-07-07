import type { Product } from "../../types/catalog";
import { formatVnd } from "../../lib/format";
import { Button } from "../ui/Button";
import { AdminCard } from "./AdminCard";
import { Plus } from "lucide-react";

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
      className="product-manager-list"
      action={
        <Button icon={<Plus size={18} />} onClick={onCreate}>
          New Item
        </Button>
      }
    >
      <div className="admin-product-list">
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
                {primaryImage ? <img src={primaryImage} alt="" /> : <span className="admin-product-thumb-placeholder" />}
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
