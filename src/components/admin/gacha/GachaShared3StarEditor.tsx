import { useMemo, useState } from "react";
import { Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";
import type { Product } from "../../../types/catalog";
import type { GachaPoolEntry } from "../../../types/gacha";
import { productImage } from "./gachaState";

type Props = {
  products: Product[];
  entries: GachaPoolEntry[];
  onToggleProduct: (productId: string) => void;
};

export function GachaShared3StarEditor({
  products,
  entries,
  onToggleProduct,
}: Props) {
  const { t } = usePlatformI18n();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"included" | "available">(
    "included",
  );

  // Custom 3-star items in pool (entries with rarity 3)
  const custom3StarEntries = useMemo(
    () => entries.filter((entry) => entry.rarity === 3),
    [entries],
  );

  const custom3StarProductIds = useMemo(
    () => new Set(custom3StarEntries.map((e) => e.product_id)),
    [custom3StarEntries],
  );

  const custom3StarProducts = useMemo(
    () => products.filter((p) => custom3StarProductIds.has(p.id)),
    [products, custom3StarProductIds],
  );

  const availableProducts = useMemo(() => {
    const assignedIds = new Set(entries.map((e) => e.product_id));
    const normalized = query.trim().toLowerCase();
    const list = products.filter((p) => !assignedIds.has(p.id));
    if (!normalized) return list;
    return list.filter((p) =>
      [p.name, p.item_code, p.category]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [entries, products, query]);

  return (
    <div className="gacha-shared-3star-body">
      <header className="gacha-panel-heading gacha-shared-heading">
        <h3>{t("3★ filler prizes")}</h3>
        <p>{t("These prizes are shared by every banner in this game.")}</p>
      </header>
        <div className="gacha-pool-toolbar">
          <div className="gacha-segmented" role="group">
            <button
              type="button"
              className={activeTab === "included" ? "active" : ""}
              onClick={() => setActiveTab("included")}
            >
              {t("Included ({{count}})", {
                count: custom3StarProducts.length,
              })}
            </button>
            <button
              type="button"
              className={activeTab === "available" ? "active" : ""}
              onClick={() => setActiveTab("available")}
            >
              {t("Add merch ({{count}})", {
                count: availableProducts.length,
              })}
            </button>
          </div>

          {activeTab === "available" && (
            <label className="gacha-search">
              <Search size={16} />
              <input
                value={query}
                placeholder={t("Search merch to add…")}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          )}
        </div>

        <div className="gacha-shared-3star-list">
          {activeTab === "included" ? (
            custom3StarProducts.length ? (
              custom3StarProducts.map((product) => {
                const image = productImage(product);
                return (
                  <div
                    key={product.id}
                    className="gacha-item is-included gacha-shared-item"
                  >
                    <span className="gacha-item-id">
                      <span className="gacha-item-img">
                        {image ? (
                          <img
                            src={image}
                            alt=""
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <Sparkles size={20} />
                        )}
                      </span>
                      <span className="gacha-item-name">
                        <strong>{product.name}</strong>
                        <small>{product.item_code || product.category}</small>
                      </span>
                    </span>
                    <span className="gacha-item-tags">
                      <span className="rarity-3">3★</span>
                      <button
                        type="button"
                        className="gacha-item-remove-btn"
                        title={t("Remove from 3★ shared pool")}
                        onClick={() => onToggleProduct(product.id)}
                      >
                        <Trash2 size={14} /> {t("Remove")}
                      </button>
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="gacha-empty-note">
                {t(
                  "No custom 3★ merch items added. Default souvenirs will be awarded automatically.",
                )}
              </p>
            )
          ) : availableProducts.length ? (
            availableProducts.map((product) => {
              const image = productImage(product);
              return (
                <div key={product.id} className="gacha-item is-available">
                  <span className="gacha-item-id">
                    <span className="gacha-item-img">
                      {image ? (
                        <img
                          src={image}
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <Sparkles size={20} />
                      )}
                    </span>
                    <span className="gacha-item-name">
                      <strong>{product.name}</strong>
                      <small>{product.item_code || product.category}</small>
                    </span>
                  </span>
                  <button
                    type="button"
                    className="gacha-item-add"
                    disabled={!product.active}
                    onClick={() => onToggleProduct(product.id)}
                  >
                    <Plus size={15} /> {t("Add as 3★ item")}
                  </button>
                </div>
              );
            })
          ) : (
            <p className="gacha-empty-note">
              {t("No available merch products to add as 3★ items.")}
            </p>
          )}
        </div>
    </div>
  );
}
