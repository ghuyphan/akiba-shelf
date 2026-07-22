import { type ReactNode, useMemo, useState } from "react";
import {
  ChevronDown,
  Gift,
  Plus,
  Search,
  Star,
  Sword,
  Sparkles,
} from "lucide-react";
import {
  getGachaBannerFeaturedRule,
  type GachaGameDescriptor,
} from "../../../lib/gacha/gachaGames";
import { matchesGachaBannerKind } from "../../../lib/gacha/gachaLimits";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";
import type { Product } from "../../../types/catalog";
import type { GachaBanner, GachaPoolEntry } from "../../../types/gacha";
import { EmptyState } from "../../ui/EmptyState";
import { Alert } from "../../ui/Alert";
import { GachaElementIcon } from "./GachaElementIcon";
import { GachaEntryEditor } from "./GachaEntryEditor";
import { productImage } from "./gachaState";

type Props = {
  products: Product[];
  banner: GachaBanner;
  banners: GachaBanner[];
  entries: GachaPoolEntry[];
  descriptor: GachaGameDescriptor;
  error?: string;
  onToggleProduct: (productId: string) => void;
  onUpdateEntry: (productId: string, changes: Partial<GachaPoolEntry>) => void;
  onToggleFeatured: (productId: string, featured: boolean) => void;
  onTextFocus: () => void;
  sharedPool: ReactNode;
  sharedCount: number;
};

export function GachaPoolEditor({
  products,
  banner,
  banners,
  entries,
  descriptor,
  error = "",
  onToggleProduct,
  onUpdateEntry,
  onToggleFeatured,
  onTextFocus,
  sharedPool,
  sharedCount,
}: Props) {
  const { t } = usePlatformI18n();
  const [query, setQuery] = useState("");
  const [poolFilter, setPoolFilter] = useState<
    "included" | "available" | "shared"
  >("included");

  // Filter for entries in this banner with 4★ or 5★ rarity
  const selectedEntries = useMemo(
    () =>
      entries.filter(
        (entry) => entry.banner_id === banner.id && entry.rarity >= 4,
      ),
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
    () =>
      activeEntries.filter(
        (entry) =>
          entry.featured &&
          entry.rarity === 5 &&
          matchesGachaBannerKind(entry, banner),
      ).length,
    [activeEntries, banner],
  );

  const secondaryFeaturedCount = useMemo(
    () =>
      activeEntries.filter(
        (entry) =>
          entry.featured &&
          entry.rarity === 4 &&
          matchesGachaBannerKind(entry, banner),
      ).length,
    [activeEntries, banner],
  );

  const featuredRule = getGachaBannerFeaturedRule(
    descriptor.gameType,
    banner.kind,
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
      {error && (
        <Alert className="gacha-section-error" variant="error">
          {error}
        </Alert>
      )}
      <div className="gacha-pool-head">
        <header className="gacha-panel-heading">
          <h3>
            {t(
              descriptor.gameType === "hsr"
                ? "Warp Banner Prizes (4★ & 5★)"
                : "Wish Banner Prizes (4★ & 5★)",
            )}
          </h3>
          <p>
            {t(
              descriptor.gameType === "genshin"
                ? banner.kind === "character"
                  ? "Character wishes go live with exactly 1 featured 5★ character and 3 featured 4★ characters."
                  : "Weapon wishes go live with exactly 2 featured 5★ weapons and 5 featured 4★ weapons."
                : "HSR event banners go live with exactly 1 featured 5★ primary and 3 featured 4★ rate-ups. Leave all featured slots empty for a standard warp; 3★ pulls use the shared souvenir pool.",
            )}
          </p>
        </header>
        <div className="gacha-pool-slot-counts">
          <span className="gacha-chip rarity-5">
            <Star size={13} aria-hidden="true" />
            {primaryFeaturedCount}/{featuredRule.fiveStarLimit} 5★
          </span>
          <span className="gacha-chip rarity-4">
            <Star size={13} aria-hidden="true" />
            {secondaryFeaturedCount}/{featuredRule.fourStarLimit} 4★
          </span>
        </div>
      </div>

      <div className="gacha-pool-toolbar">
        <div
          className="gacha-segmented gacha-pool-filters"
          role="group"
          aria-label={t("Filter pool items")}
        >
          {(["included", "available", "shared"] as const).map((filter) => (
            <button
              type="button"
              key={filter}
              className={poolFilter === filter ? "active" : ""}
              aria-pressed={poolFilter === filter}
              onClick={() => setPoolFilter(filter)}
            >
              {filter === "included"
                ? t("Banner Prizes ({{count}})", {
                    count: selectedEntries.length,
                  })
                : filter === "available"
                  ? t("Add merch ({{count}})", {
                      count: products.filter(
                        (product) => !entriesByProduct.has(product.id),
                      ).length,
                    })
                  : t("3★ filler ({{count}})", { count: sharedCount })}
            </button>
          ))}
        </div>
        {poolFilter !== "shared" && (
          <label className="gacha-search">
            <Search size={16} />
            <input
              value={query}
              placeholder={t("Search merch…")}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        )}
      </div>

      {poolFilter === "shared" ? (
        <div className="gacha-shared-pool-tab">
          <Gift size={18} aria-hidden="true" />
          {sharedPool}
        </div>
      ) : (
        <div className="gacha-pool-list admin-scroll-list">
          {visibleProducts.length ? (
            visibleProducts.map((product) => {
              const entry = entriesByProduct.get(product.id);
              const image = productImage(product);

              const identity = (
                <span className="gacha-item-id">
                  <span className="gacha-item-img">
                    {image ? (
                      <img src={image} alt="" loading="lazy" decoding="async" />
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
                const addDisabledReason = owner
                  ? t(
                      "This item is already in “{{banner}}”. Remove it there first.",
                      { banner: owner.name },
                    )
                  : !product.active
                    ? t(
                        "Hidden merch cannot be added until it is active in the catalog.",
                      )
                    : "";
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
                      <span className="gacha-tag is-hidden">{t("Hidden")}</span>
                    )}
                    <button
                      type="button"
                      className="gacha-item-add"
                      disabled={!product.active || Boolean(owner)}
                      title={addDisabledReason || undefined}
                      aria-label={
                        addDisabledReason
                          ? `${t("Add to banner")}: ${addDisabledReason}`
                          : undefined
                      }
                      onClick={() => onToggleProduct(product.id)}
                    >
                      <Plus size={15} /> {t("Add to banner")}
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
                      <b className={`rarity-${entry.rarity}`}>
                        {entry.rarity}★
                      </b>
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
                          {t(entry.rarity === 5 ? "5★ featured" : "4★ rate-up")}
                        </span>
                      )}
                      {!entry.active && (
                        <span className="gacha-tag is-inactive">
                          {t("Inactive")}
                        </span>
                      )}
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
                    onUpdateEntry={(changes) =>
                      onUpdateEntry(product.id, changes)
                    }
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
      )}
    </div>
  );
}
