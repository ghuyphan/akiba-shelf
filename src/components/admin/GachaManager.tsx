import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  Gamepad2,
  Layers3,
  LoaderCircle,
  Plus,
  Search,
  Sparkles,
  Star,
  Sword,
  Trash2,
  UserRound,
} from "lucide-react";
import "../../styles/gacha-admin.css";
import {
  getAdminGachaConfiguration,
  saveGachaConfiguration,
} from "../../lib/api";
import { safePublicUrl } from "../../lib/branding";
import { getErrorMessage } from "../../lib/errors";
import { usePlatformI18n } from "../../lib/platformI18n";
import type { Product } from "../../types/catalog";
import {
  defaultGachaBanner,
  type GachaBanner,
  type GachaElement,
  type GachaItemKind,
  type GachaPoolEntry,
  type GachaRarity,
  type GachaSettings,
  type GachaWeaponType,
} from "../../types/gacha";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Field, TextArea, TextInput } from "../ui/Field";
import { SelectMenu, type SelectMenuOption } from "../ui/SelectMenu";
import { useToast } from "../ui/ToastProvider";
import { AdminCard } from "./AdminCard";

type Props = { shopId: string; shopSlug: string; products: Product[] };

const rarityOptions: SelectMenuOption[] = [3, 4, 5].map((rarity) => ({
  value: String(rarity),
  label: `${rarity}★`,
  icon: <Star size={15} />,
}));
const elementOptions: SelectMenuOption[] = [
  "anemo",
  "geo",
  "electro",
  "dendro",
  "hydro",
  "pyro",
  "cryo",
].map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }));

function newEntry(
  shopId: string,
  bannerId: string,
  productId: string,
  kind: GachaItemKind,
): GachaPoolEntry {
  return {
    shop_id: shopId,
    banner_id: bannerId,
    product_id: productId,
    kind,
    element: "anemo",
    weapon_type: "sword",
    rarity: 3,
    weight: 100,
    featured: false,
    active: true,
  };
}

function productImage(product: Product) {
  return safePublicUrl(
    product.image_variants?.[0]?.thumbnail ?? product.images[0] ?? "",
  );
}

function capFeaturedEntries(
  sourceEntries: GachaPoolEntry[],
  sourceBanners: GachaBanner[],
) {
  const limits = new Map(
    sourceBanners.map((banner) => [banner.id, banner.display_limit]),
  );
  const featuredSeen = new Map<string, number>();
  return sourceEntries.map((entry) => {
    if (!entry.active || !entry.featured) return entry;
    const seen = featuredSeen.get(entry.banner_id) ?? 0;
    featuredSeen.set(entry.banner_id, seen + 1);
    return seen < (limits.get(entry.banner_id) ?? 1)
      ? entry
      : { ...entry, featured: false };
  });
}

function DropdownField({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: SelectMenuOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`field ${disabled ? "is-disabled" : ""}`}>
      <span className="field-label">{label}</span>
      <SelectMenu
        label={label}
        value={value}
        options={options}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}

export function GachaManager({ shopId, shopSlug, products }: Props) {
  const [settings, setSettings] = useState<GachaSettings | null>(null);
  const [banners, setBanners] = useState<GachaBanner[]>([]);
  const [entries, setEntries] = useState<GachaPoolEntry[]>([]);
  const [selectedBannerId, setSelectedBannerId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const { t } = usePlatformI18n();
  const kindOptions = useMemo<SelectMenuOption[]>(
    () => [
      {
        value: "character",
        label: t("Character"),
        icon: <UserRound size={15} />,
      },
      { value: "weapon", label: t("Weapon"), icon: <Sword size={15} /> },
    ],
    [t],
  );
  const weaponOptions = useMemo<SelectMenuOption[]>(
    () =>
      ["sword", "claymore", "polearm", "bow", "catalyst"].map((value) => ({
        value,
        label: t(value[0].toUpperCase() + value.slice(1)),
      })),
    [t],
  );
  const displayLimitOptions = useMemo<SelectMenuOption[]>(
    () =>
      [1, 2, 3, 4, 5].map((value) => ({
        value: String(value),
        label: `${value} ${t("featured items")}`,
      })),
    [t],
  );

  const load = useCallback(async () => {
    const next = await getAdminGachaConfiguration(shopId);
    const nextBanners = next.banners.length
      ? next.banners
      : [defaultGachaBanner(shopId)];
    setSettings(next.settings);
    setBanners(nextBanners);
    setEntries(capFeaturedEntries(next.entries, nextBanners));
    setSelectedBannerId((current) =>
      nextBanners.some((banner) => banner.id === current)
        ? current
        : nextBanners[0].id,
    );
  }, [shopId]);

  useEffect(() => {
    setLoading(true);
    void load()
      .catch((error) =>
        toast.error(
          t(getErrorMessage(error, "Could not load the minigame.")),
          t("Gacha unavailable"),
        ),
      )
      .finally(() => setLoading(false));
  }, [load, t, toast]);

  const selectedBanner = banners.find(
    (banner) => banner.id === selectedBannerId,
  );
  const selectedEntries = entries.filter(
    (entry) => entry.banner_id === selectedBannerId,
  );
  const entriesByProduct = useMemo(
    () => new Map(selectedEntries.map((entry) => [entry.product_id, entry])),
    [selectedEntries],
  );
  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = normalized
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
    return [...filtered].sort(
      (a, b) =>
        Number(entriesByProduct.has(b.id)) - Number(entriesByProduct.has(a.id)),
    );
  }, [entriesByProduct, products, query]);

  function updateBanner(changes: Partial<GachaBanner>) {
    setBanners((current) =>
      current.map((banner) =>
        banner.id === selectedBannerId ? { ...banner, ...changes } : banner,
      ),
    );
  }

  function updateDisplayLimit(displayLimit: number) {
    updateBanner({ display_limit: displayLimit });
    setEntries((current) =>
      capFeaturedEntries(
        current,
        banners.map((banner) =>
          banner.id === selectedBannerId
            ? { ...banner, display_limit: displayLimit }
            : banner,
        ),
      ),
    );
  }

  function addBanner(source?: GachaBanner) {
    const banner = {
      ...(source ?? defaultGachaBanner(shopId)),
      id: crypto.randomUUID(),
      name: source ? `${source.name} copy` : `Banner ${banners.length + 1}`,
      sort_order: banners.length,
    };
    setBanners((current) => [...current, banner]);
    if (source) {
      setEntries((current) => [
        ...current,
        ...current
          .filter((entry) => entry.banner_id === source.id)
          .map((entry) => ({ ...entry, banner_id: banner.id })),
      ]);
    }
    setSelectedBannerId(banner.id);
  }

  function removeBanner() {
    if (!selectedBanner || banners.length === 1) return;
    const next = banners.filter((banner) => banner.id !== selectedBanner.id);
    setBanners(next);
    setEntries((current) =>
      current.filter((entry) => entry.banner_id !== selectedBanner.id),
    );
    setSelectedBannerId(next[0]?.id ?? "");
  }

  function moveBanner(delta: number) {
    const index = banners.findIndex((banner) => banner.id === selectedBannerId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= banners.length) return;
    const next = [...banners];
    [next[index], next[target]] = [next[target], next[index]];
    setBanners(next.map((banner, sort_order) => ({ ...banner, sort_order })));
  }

  function toggleProduct(productId: string) {
    if (!selectedBanner) return;
    setEntries((current) => {
      const existing = current.some(
        (entry) =>
          entry.banner_id === selectedBanner.id &&
          entry.product_id === productId,
      );
      return existing
        ? current.filter(
            (entry) =>
              !(
                entry.banner_id === selectedBanner.id &&
                entry.product_id === productId
              ),
          )
        : [
            ...current,
            newEntry(shopId, selectedBanner.id, productId, selectedBanner.kind),
          ];
    });
  }

  function updateEntry(productId: string, changes: Partial<GachaPoolEntry>) {
    setEntries((current) =>
      current.map((entry) =>
        entry.banner_id === selectedBannerId && entry.product_id === productId
          ? { ...entry, ...changes }
          : entry,
      ),
    );
  }

  function updateFeatured(productId: string, featured: boolean) {
    const entry = entriesByProduct.get(productId);
    if (!entry || !selectedBanner) return;
    if (featured && featuredCount >= selectedBanner.display_limit) {
      toast.info(
        t("This banner can show up to {{count}} featured items.", {
          count: selectedBanner.display_limit,
        }),
        t("Featured slots are full"),
      );
      return;
    }
    updateEntry(productId, {
      featured,
      active: featured ? true : entry.active,
    });
  }

  function openPreview() {
    if (!settings) return;
    const productsById = new Map(
      products.map((product) => [product.id, product]),
    );
    const previewEntries = capFeaturedEntries(entries, banners).flatMap(
      (entry) => {
        const product = productsById.get(entry.product_id);
        return product && entry.active ? [{ ...entry, product }] : [];
      },
    );
    localStorage.setItem(
      `matsuri-gacha-preview-config:${shopSlug}`,
      JSON.stringify({ settings, banners, entries: previewEntries }),
    );
    window.open(
      `/s/${shopSlug}/play?preview=1`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function save() {
    if (!settings) return;
    const activeBanners = banners.filter((banner) => banner.active);
    if (
      !settings.title.trim() ||
      banners.some((banner) => !banner.name.trim())
    ) {
      toast.error(
        t("Give the minigame and every banner a title."),
        t("Check gacha settings"),
      );
      return;
    }
    if (settings.legendary_pity <= settings.rare_pity) {
      toast.error(
        t("The 5-star pity must be higher than the 4-star pity."),
        t("Check gacha settings"),
      );
      return;
    }
    if (
      settings.enabled &&
      activeBanners.some(
        (banner) =>
          !entries.some(
            (entry) => entry.banner_id === banner.id && entry.active,
          ),
      )
    ) {
      toast.error(
        t("Every active banner needs at least one active merch item."),
        t("Wish pool is empty"),
      );
      return;
    }
    setSaving(true);
    try {
      const cappedEntries = capFeaturedEntries(entries, banners);
      const saved = await saveGachaConfiguration(
        shopId,
        settings,
        banners,
        cappedEntries,
      );
      setSettings(saved.settings);
      setBanners(saved.banners);
      setEntries(saved.entries);
      toast.success(t("Gacha settings published."));
    } catch (error) {
      toast.error(
        t(getErrorMessage(error, "Could not save the minigame.")),
        t("Could not publish gacha"),
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings || !selectedBanner) {
    return (
      <EmptyState
        tone="loading"
        icon={<LoaderCircle className="state-spinner" size={28} />}
        title={t("Loading gacha settings…")}
        message={t("Preparing the shop’s merch banners.")}
      />
    );
  }

  const activeEntries = selectedEntries.filter((entry) => entry.active);
  const featuredCount = activeEntries.filter((entry) => entry.featured).length;
  const bannerIndex = banners.findIndex(
    (banner) => banner.id === selectedBanner.id,
  );

  return (
    <div className="gacha-admin-page">
      <AdminCard
        className="gacha-global-card"
        icon={<Gamepad2 size={18} />}
        title={t("Simulator rules")}
        description={t("Shared availability and pity across every banner.")}
        action={
          <div className="gacha-header-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={openPreview}
            >
              <Eye size={16} /> <span>{t("Open preview")}</span>
            </button>
            <Button
              icon={<Sparkles size={16} />}
              loading={saving}
              loadingText={t("Publishing…")}
              onClick={() => void save()}
            >
              {t("Publish gacha")}
            </Button>
          </div>
        }
      >
        <div className="gacha-global-rules">
          <div className="gacha-global-status">
            <small>{t("Minigame")}</small>
            <label className="gacha-toggle">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(event) =>
                  setSettings({ ...settings, enabled: event.target.checked })
                }
              />
              <span aria-hidden="true" />
              <b>{t(settings.enabled ? "Open" : "Closed")}</b>
            </label>
          </div>
          <Field label={t("4-star pity")}>
            <TextInput
              type="number"
              min={2}
              max={30}
              value={settings.rare_pity}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  rare_pity: Number(event.target.value),
                })
              }
            />
          </Field>
          <Field label={t("5-star pity")}>
            <TextInput
              type="number"
              min={10}
              max={100}
              value={settings.legendary_pity}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  legendary_pity: Number(event.target.value),
                })
              }
            />
          </Field>
        </div>
      </AdminCard>

      <div className="gacha-editor-grid">
        <AdminCard
          className="gacha-banner-sidebar"
          icon={<Layers3 size={18} />}
          title={t("Banners")}
          description={t("Add, order, duplicate, or disable banners.")}
          action={
            <button
              type="button"
              className="icon-button"
              aria-label={t("Add banner")}
              onClick={() => addBanner()}
            >
              <Plus size={17} />
            </button>
          }
        >
          <div className="gacha-banner-list">
            {banners.map((banner) => {
              const count = entries.filter(
                (entry) => entry.banner_id === banner.id && entry.active,
              ).length;
              return (
                <button
                  type="button"
                  key={banner.id}
                  className={`gacha-banner-item ${banner.id === selectedBannerId ? "active" : ""}`}
                  onClick={() => setSelectedBannerId(banner.id)}
                >
                  <span className={`gacha-banner-kind ${banner.kind}`}>
                    {banner.kind === "weapon" ? (
                      <Sword size={16} />
                    ) : (
                      <UserRound size={16} />
                    )}
                  </span>
                  <span>
                    <strong>{banner.name}</strong>
                    <small>
                      {count} {t("items")} · {banner.display_limit} {t("shown")}
                    </small>
                  </span>
                  <i className={banner.active ? "is-live" : ""} />
                </button>
              );
            })}
          </div>
          <div className="gacha-banner-actions">
            <button
              type="button"
              className="icon-button"
              onClick={() => moveBanner(-1)}
              disabled={bannerIndex === 0}
              aria-label={t("Move banner up")}
            >
              <ArrowUp size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => moveBanner(1)}
              disabled={bannerIndex === banners.length - 1}
              aria-label={t("Move banner down")}
            >
              <ArrowDown size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => addBanner(selectedBanner)}
              aria-label={t("Duplicate banner")}
            >
              <Copy size={16} />
            </button>
            <button
              type="button"
              className="icon-button danger"
              onClick={removeBanner}
              disabled={banners.length === 1}
              aria-label={t("Delete banner")}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </AdminCard>

        <div className="gacha-editor-main">
          <AdminCard
            className="gacha-banner-editor"
            icon={
              selectedBanner.kind === "weapon" ? (
                <Sword size={18} />
              ) : (
                <UserRound size={18} />
              )
            }
            title={selectedBanner.name}
            description={t("Choose how this banner appears in the simulator.")}
            action={
              <label className="gacha-mini-check banner-active">
                <input
                  type="checkbox"
                  checked={selectedBanner.active}
                  onChange={(event) =>
                    updateBanner({ active: event.target.checked })
                  }
                />
                <Sparkles size={15} /> {t("Banner active")}
              </label>
            }
          >
            <div className="gacha-banner-settings-grid">
              <Field label={t("Banner title")}>
                <TextInput
                  maxLength={80}
                  value={selectedBanner.name}
                  onChange={(event) =>
                    updateBanner({ name: event.target.value })
                  }
                />
              </Field>
              <DropdownField
                label={t("Banner type")}
                value={selectedBanner.kind}
                options={kindOptions}
                onChange={(value) =>
                  updateBanner({ kind: value as GachaItemKind })
                }
              />
              <Field label={t("Banner copy")}>
                <TextArea
                  maxLength={240}
                  value={selectedBanner.description}
                  onChange={(event) =>
                    updateBanner({ description: event.target.value })
                  }
                />
              </Field>
              <DropdownField
                label={t("Featured items shown")}
                value={String(selectedBanner.display_limit)}
                options={displayLimitOptions}
                onChange={(value) => updateDisplayLimit(Number(value))}
              />
              <DropdownField
                label={t("Banner theme")}
                value={selectedBanner.theme}
                options={elementOptions}
                onChange={(value) =>
                  updateBanner({ theme: value as GachaElement })
                }
              />
            </div>
          </AdminCard>

          <AdminCard
            className="gacha-pool-editor"
            icon={<Star size={18} />}
            title={t("Wish pool")}
            description={t(
              "Add merch, then tune rarity, role, and featured placement.",
            )}
          >
            <div className="gacha-pool-tools">
              <div className="gacha-pool-summary compact">
                <div>
                  <strong>{activeEntries.length}</strong>
                  <span>{t("active")}</span>
                </div>
                <div>
                  <strong>{featuredCount}</strong>
                  <span>{t("featured")}</span>
                </div>
                {([3, 4, 5] as GachaRarity[]).map((rarity) => (
                  <div key={rarity} className={`rarity-${rarity}`}>
                    <strong>
                      {
                        activeEntries.filter((entry) => entry.rarity === rarity)
                          .length
                      }
                    </strong>
                    <span>{rarity}★</span>
                  </div>
                ))}
              </div>
              <label className="gacha-product-search">
                <Search size={17} />
                <input
                  value={query}
                  placeholder={t("Search merch…")}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
            </div>
            <div className="gacha-product-list">
              {visibleProducts.length ? (
                visibleProducts.map((product) => {
                  const entry = entriesByProduct.get(product.id);
                  const image = productImage(product);
                  return (
                    <article
                      key={product.id}
                      className={`gacha-product-row ${entry ? "is-included" : ""} ${!product.active ? "is-inactive" : ""}`}
                    >
                      <button
                        type="button"
                        className="gacha-product-include"
                        aria-pressed={Boolean(entry)}
                        disabled={!product.active && !entry}
                        onClick={() => toggleProduct(product.id)}
                      >
                        <span className="gacha-product-image">
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
                        <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <strong>{product.name}</strong>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            <small>{product.item_code || product.category}</small>
                            {!product.active && (
                              <span className="admin-badge-hidden">
                                {t("Hidden")}
                              </span>
                            )}
                          </span>
                        </span>
                        <b>{t(entry ? "Included" : "Add")}</b>
                      </button>
                      {entry && (
                        <div className={`gacha-product-controls ${!product.active ? "is-disabled" : ""}`}>
                          <DropdownField
                            label={t("Role")}
                            value={entry.kind}
                            options={kindOptions}
                            disabled={!product.active}
                            onChange={(value) =>
                              updateEntry(product.id, {
                                kind: value as GachaItemKind,
                              })
                            }
                          />
                          <DropdownField
                            label={t("Rarity")}
                            value={String(entry.rarity)}
                            options={rarityOptions}
                            disabled={!product.active}
                            onChange={(value) =>
                              updateEntry(product.id, {
                                rarity: Number(value) as GachaRarity,
                              })
                            }
                          />
                          {entry.kind === "character" ? (
                            <DropdownField
                              label={t("Element icon")}
                              value={entry.element}
                              options={elementOptions}
                              disabled={!product.active}
                              onChange={(value) =>
                                updateEntry(product.id, {
                                  element: value as GachaElement,
                                })
                              }
                            />
                          ) : (
                            <DropdownField
                              label={t("Weapon class")}
                              value={entry.weapon_type}
                              options={weaponOptions}
                              disabled={!product.active}
                              onChange={(value) =>
                                updateEntry(product.id, {
                                  weapon_type: value as GachaWeaponType,
                                })
                              }
                            />
                          )}
                          <Field label={t("Weight")}>
                            <TextInput
                              type="number"
                              min={1}
                              max={1000}
                              value={entry.weight}
                              disabled={!product.active}
                              onChange={(event) =>
                                updateEntry(product.id, {
                                  weight: Number(event.target.value),
                                })
                              }
                            />
                          </Field>
                          <label
                            className={`gacha-mini-check ${(!entry.featured && featuredCount >= selectedBanner.display_limit) || !product.active ? "is-disabled" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={entry.featured}
                              disabled={
                                (!entry.featured &&
                                  featuredCount >= selectedBanner.display_limit) ||
                                !product.active
                              }
                              onChange={(event) =>
                                updateFeatured(product.id, event.target.checked)
                              }
                            />
                            <Star size={15} /> {t("Featured")}
                          </label>
                          <label className={`gacha-mini-check ${!product.active ? "is-disabled" : ""}`}>
                            <input
                              type="checkbox"
                              checked={entry.active}
                              disabled={!product.active}
                              onChange={(event) =>
                                updateEntry(product.id, {
                                  active: event.target.checked,
                                  featured: event.target.checked
                                    ? entry.featured
                                    : false,
                                })
                              }
                            />
                            {entry.kind === "weapon" ? (
                              <Sword size={15} />
                            ) : (
                              <UserRound size={15} />
                            )}
                            {t("Active")}
                          </label>
                        </div>
                      )}
                    </article>
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
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
