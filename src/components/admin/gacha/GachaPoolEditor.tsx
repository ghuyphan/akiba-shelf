import { useMemo, useState } from "react";
import { ChevronDown, Plus, Search, Star, Sword, Sparkles } from "lucide-react";
import type { GachaGameDescriptor } from "../../../lib/gachaGames";
import { usePlatformI18n } from "../../../lib/platformI18n";
import type { Product } from "../../../types/catalog";
import type { GachaBanner, GachaPoolEntry } from "../../../types/gacha";
import { EmptyState } from "../../ui/EmptyState";
import { GachaElementIcon } from "./GachaElementIcon";
import { GachaEntryEditor } from "./GachaEntryEditor";
import { productImage } from "./gachaState";

type Props = {
  products: Product[];
  banner: GachaBanner;
  banners: GachaBanner[];
  entries: GachaPoolEntry[];
  descriptor: GachaGameDescriptor;
  onToggleProduct: (productId: string) => void;
  onUpdateEntry: (productId: string, changes: Partial<GachaPoolEntry>) => void;
  onToggleFeatured: (productId: string, featured: boolean) => void;
  onTextFocus: () => void;
};

export function GachaPoolEditor({
  products,
  banner,
  banners,
  entries,
  descriptor,
  onToggleProduct,
  onUpdateEntry,
  onToggleFeatured,
  onTextFocus,
}: Props) {
  const { t } = usePlatformI18n();
  const [query, setQuery] = useState("");
  const [poolFilter, setPoolFilter] = useState<"included" | "available">("included");

  const selectedEntries = useMemo(
    () => entries.filter((entry) => entry.banner_id === banner.id),
    [entries, banner.id],
  );

  const entriesByProduct = useMemo(
    () => new Map(selectedEntries.map((entry) => [entry.product_id, entry])),
    [selectedEntries],
  );

  const assignedBannerByProduct = useMemo(() => {
    const map = new Map<string, GachaBanner>();
    for (const entry of entries) {
      if (map.has(entry.product_id)) continue;
      const owner = banners.find((b) => b.id === entry.banner_id);
      if (owner) map.set(entry.product_id, owner);
    }
    return map;
  }, [banners, entries]);

  const activeEntries = useMemo(
    () => selectedEntries.filter((entry) => entry.active),
    [selectedEntries],
  );

  const featuredCount = useMemo(
    () => activeEntries.filter((entry) => entry.featured).length,
    [activeEntries],
  );

  const primaryFeaturedCount = useMemo(
    () => activeEntries.filter((entry) => entry.featured && entry.rarity === 5).length,
    [activeEntries],
  );

  const secondaryFeaturedCount = useMemo(
    () => activeEntries.filter((entry) => entry.featured && entry.rarity === 4).length,
    [activeEntries],
  );

  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const searched = normalized
      ? products.filter((product) =>
          [
            product.name,
            product.item_code,
            product.category,
            product.collection,
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalized),
        )
      : products;
    const filtered = searched.filter((product) => {
      return poolFilter === "included"
        ? entriesByProduct.has(product.id)
        : !entriesByProduct.has(product.id);
    });
    return [...filtered].sort((a, b) => {
      const rank = (product: Product) => {
        if (entriesByProduct.has(product.id)) return 0;
        const owner = assignedBannerByProduct.get(product.id);
        if (owner && owner.id !== banner.id) return 2;
        return 1;
      };
      return rank(a) - rank(b);
    });
  }, [
    assignedBannerByProduct,
    entriesByProduct,
    poolFilter,
    products,
    query,
    banner.id,
  ]);

  return (
    <div className="gacha-pool-section">
      <div className="gacha-pool-head">
        <header className="gacha-panel-heading">
          <h3>
            {t(descriptor.gameType === "hsr" ? "Warp pool" : "Wish pool")}
          </h3>
          <p>
            {t("Add merch, then tune rarity, role, and featured placement.")}
          </p>
        </header>
        <span className="gacha-chip">
          <Star size={13} aria-hidden="true" />
          {featuredCount}/{banner.display_limit} {t("featured")}
        </span>
      </div>

      <div className="gacha-pool-toolbar">
        <div
          className="gacha-segmented"
          role="group"
          aria-label={t("Filter pool items")}
        >
          {(["included", "available"] as const).map((filter) => (
            <button
              type="button"
              key={filter}
              className={poolFilter === filter ? "active" : ""}
              aria-pressed={poolFilter === filter}
              onClick={() => setPoolFilter(filter)}
            >
              {filter === "included"
                ? t("Pool items ({{count}})", {
                    count: selectedEntries.length,
                  })
                : t("Add products ({{count}})", {
                    count: products.filter(
                      (product) => !entriesByProduct.has(product.id),
                    ).length,
                  })}
            </button>
          ))}
        </div>
        <label className="gacha-search">
          <Search size={16} />
          <input
            value={query}
            placeholder={t("Search merch…")}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <div className="gacha-pool-list">
        {visibleProducts.length ? (
          visibleProducts.map((product) => {
            const entry = entriesByProduct.get(product.id);
            const image = productImage(product);

            const identity = (
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
            );

            if (!entry) {
              const owner = assignedBannerByProduct.get(product.id);
              return (
                <article
                  key={product.id}
                  className={`gacha-item is-available ${!product.active ? "is-inactive" : ""}`}
                >
                  {identity}
                  {owner && (
                    <span
                      className="gacha-tag is-owned"
                      title={t(
                        "This item is already in “{{banner}}”. Remove it there first.",
                        { banner: owner.name },
                      )}
                    >
                      {t("In “{{banner}}”", { banner: owner.name })}
                    </span>
                  )}
                  {!product.active && (
                    <span className="gacha-tag is-hidden">
                      {t("Hidden")}
                    </span>
                  )}
                  <button
                    type="button"
                    className="gacha-item-add"
                    disabled={!product.active || Boolean(owner)}
                    title={
                      owner
                        ? t(
                            "This item is already in “{{banner}}”. Remove it there first.",
                            { banner: owner.name },
                          )
                        : undefined
                    }
                    onClick={() => onToggleProduct(product.id)}
                  >
                    <Plus size={15} /> {t("Add to pool")}
                  </button>
                </article>
              );
            }

            return (
              <details
                key={product.id}
                className={`gacha-item is-included ${!product.active ? "is-inactive" : ""}`}
              >
                <summary>
                  {identity}
                  <span className="gacha-item-config">
                    <b className={`rarity-${entry.rarity}`}>{entry.rarity}★</b>
                    {entry.kind === "character" ? (
                      <GachaElementIcon
                        gameType={descriptor.gameType}
                        element={entry.element}
                        size={16}
                      />
                    ) : (
                      <Sword size={14} />
                    )}
                    <span>
                      {t(
                        entry.kind === "character"
                          ? entry.element[0].toUpperCase() +
                              entry.element.slice(1)
                          : entry.weapon_type[0].toUpperCase() +
                              entry.weapon_type.slice(1),
                      )}
                    </span>
                  </span>
                  <span className="gacha-item-tags">
                    {entry.featured && (
                      <span className="gacha-tag is-featured">
                        {t(
                          descriptor.gameType === "hsr"
                            ? entry.rarity === 5
                              ? "Primary"
                              : "Rate-up"
                            : "Featured",
                        )}
                      </span>
                    )}
                    <span
                      className={`gacha-tag ${entry.active ? "is-active" : "is-inactive"}`}
                    >
                      {t(entry.active ? "Active" : "Inactive")}
                    </span>
                  </span>
                  <span className="gacha-item-expand" aria-hidden="true">
                    <ChevronDown size={16} />
                  </span>
                </summary>
                <GachaEntryEditor
                  entry={entry}
                  productActive={product.active}
                  banner={banner}
                  descriptor={descriptor}
                  featuredCount={featuredCount}
                  primaryFeaturedCount={primaryFeaturedCount}
                  secondaryFeaturedCount={secondaryFeaturedCount}
                  onUpdateEntry={(changes) => onUpdateEntry(product.id, changes)}
                  onToggleFeatured={(featured) =>
                    onToggleFeatured(product.id, featured)
                  }
                  onRemove={() => onToggleProduct(product.id)}
                  onTextFocus={onTextFocus}
                />
              </details>
            );
          })
        ) : (
          <EmptyState
            variant="compact"
            icon={<Search size={24} />}
            title={t("No matching merch")}
            message={t("Try another product name, code, or category.")}
          />
        )}
      </div>
    </div>
  );
}
