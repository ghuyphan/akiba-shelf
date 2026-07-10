import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Languages, LayoutTemplate, Palette, Save } from "lucide-react";
import type { BoothSettings, Product, StorefrontSection } from "../../types/catalog";
import { getThemeStyle } from "../../lib/theme";
import { CatalogLocaleProvider } from "../../lib/catalogI18n";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { CatalogHeader } from "../catalog/CatalogHeader";
import { CategoryFilters } from "../catalog/CategoryFilters";
import { CatalogToolbar } from "../catalog/CatalogToolbar";
import { ProductGrid } from "../catalog/ProductGrid";
import { StackedFeatured } from "../catalog/StackedFeatured";
import { BoothInfoPanel } from "../catalog/BoothInfoPanel";
import { SelectedItemPanel } from "../catalog/SelectedItemPanel";

type StorefrontDesignerProps = {
  settings: BoothSettings;
  products: Product[];
  onSave: (settings: BoothSettings) => Promise<void>;
};

const allowedSections: StorefrontSection[] = ["featured", "booth", "controls", "cart", "products"];
const sectionMeta: Record<StorefrontSection, { title: string; description: string; size: string }> = {
  featured: { title: "Featured spotlight", description: "Promoted products and swipe deck", size: "Wide" },
  booth: { title: "Booth information", description: "Location, hours, and social QR codes", size: "Side" },
  controls: { title: "Browse controls", description: "Categories, search, sort, and view mode", size: "Wide" },
  cart: { title: "Shopping cart", description: "Selected items and checkout action", size: "Side" },
  products: { title: "Product collection", description: "The complete item grid or list", size: "Wide" },
};

function normalizedOrder(order?: StorefrontSection[]) {
  return order?.length === allowedSections.length && allowedSections.every((item) => order.includes(item)) ? order : allowedSections;
}

export function StorefrontDesigner({ settings, products, onSave }: StorefrontDesignerProps) {
  const [draft, setDraft] = useState(settings);
  const [dragged, setDragged] = useState<StorefrontSection | null>(null);
  const [previewSearch, setPreviewSearch] = useState("");
  const [previewSort, setPreviewSort] = useState("recommended");
  const [previewView, setPreviewView] = useState<"grid" | "list">("grid");
  const { busy, error, run, setError } = useAsyncAction();
  const order = normalizedOrder(draft.layout_order);

  useEffect(() => { setDraft(settings); setError(""); }, [settings, setError]);

  const previewProducts = useMemo(() => {
    const active = products.filter((product) => product.active).slice(0, 6);
    if (active.some((product) => product.featured) || active.length === 0) return active;
    return active.map((product, index) => index === 0 ? { ...product, featured: true } : product);
  }, [products]);
  const categories = useMemo(() => ["All", ...Array.from(new Set(previewProducts.map((product) => product.category))).filter(Boolean)], [previewProducts]);
  const previewCartProduct = previewProducts.find((product) => product.quantity_available > 0);

  function move(section: StorefrontSection, target: StorefrontSection) {
    if (section === target) return;
    const next = order.filter((item) => item !== section);
    next.splice(next.indexOf(target), 0, section);
    setDraft((current) => ({ ...current, layout_order: next }));
  }

  function nudge(section: StorefrontSection, direction: -1 | 1) {
    const index = order.indexOf(section);
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setDraft((current) => ({ ...current, layout_order: next }));
  }

  function dropOn(target: StorefrontSection) {
    if (dragged) move(dragged, target);
    setDragged(null);
  }

  async function save() {
    await run(() => onSave({ ...draft, layout_order: order })).catch(() => undefined);
  }

  const previewBlocks: Record<StorefrontSection, React.ReactNode> = {
    featured: <StackedFeatured products={previewProducts} onSelect={() => undefined} />,
    controls: <div className="catalog-controls"><CategoryFilters categories={categories} activeCategory="All" onChange={() => undefined} /><CatalogToolbar searchQuery={previewSearch} onSearchChange={setPreviewSearch} sort={previewSort} viewMode={previewView} onSortChange={setPreviewSort} onViewModeChange={setPreviewView} /></div>,
    products: <ProductGrid products={previewProducts} totalProducts={previewProducts.length} activeCategory="All" viewMode={previewView} onSelect={() => undefined} onViewDetails={() => undefined} onResetFilters={() => undefined} />,
    booth: <BoothInfoPanel booth={draft} />,
    cart: <SelectedItemPanel cart={previewCartProduct ? [{ product: previewCartProduct, quantity: 1 }] : []} onQuantityChange={() => undefined} onRemove={() => undefined} onOpenPayment={() => undefined} onClearCart={() => undefined} />,
  };

  return (
    <section className="storefront-designer">
      <div className="designer-controls admin-surface">
        <div className="designer-panel-heading"><span><LayoutTemplate size={18} /></span><div><h2>Storefront layout</h2><p>Drag modules in the preview or use this list. The fixed grid preserves safe module widths.</p></div></div>
        <div className="designer-block-list">
          {order.map((section, index) => <article key={section} draggable onDragStart={() => setDragged(section)} onDragEnd={() => setDragged(null)} onDragOver={(event) => event.preventDefault()} onDrop={() => dropOn(section)} className={dragged === section ? "dragging" : ""}><GripVertical size={17} /><span><strong>{sectionMeta[section].title}</strong><small>{sectionMeta[section].description}</small></span><em>{sectionMeta[section].size}</em><div><button type="button" disabled={index === 0} onClick={() => nudge(section, -1)} aria-label={`Move ${sectionMeta[section].title} up`}><ArrowUp size={14} /></button><button type="button" disabled={index === order.length - 1} onClick={() => nudge(section, 1)} aria-label={`Move ${sectionMeta[section].title} down`}><ArrowDown size={14} /></button></div></article>)}
        </div>

        <div className="designer-setting-group"><div><Palette size={16} /><span><strong>Corner radius</strong><small>{draft.corner_radius ?? 16}px across storefront cards</small></span></div><input type="range" min="0" max="32" step="1" value={draft.corner_radius ?? 16} onChange={(event) => setDraft({ ...draft, corner_radius: Number(event.target.value) })} /></div>
        <div className="designer-color-grid">{([['theme_primary','Primary','#6366f1'],['theme_secondary','Dark','#0f172a'],['theme_accent','Accent','#10b981'],['theme_background','Page','#f8fafc']] as const).map(([key,label,fallback]) => <label key={key}><span>{label}</span><div><input type="color" value={draft[key] ?? fallback} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /><code>{draft[key] ?? fallback}</code></div></label>)}</div>
        <div className="designer-locale"><Languages size={17} /><span><strong>Storefront language</strong><small>Applies to customer-facing interface copy.</small></span><div><button type="button" className={(draft.catalog_locale ?? "en") === "en" ? "active" : ""} onClick={() => setDraft({ ...draft, catalog_locale: "en" })}>EN</button><button type="button" className={draft.catalog_locale === "vi" ? "active" : ""} onClick={() => setDraft({ ...draft, catalog_locale: "vi" })}>VI</button></div></div>
        {error && <Alert variant="error" title="Could not save storefront" onClose={() => setError("")}>{error}</Alert>}
        <Button icon={<Save size={17} />} loading={busy} loadingText="Saving…" onClick={() => void save()}>Publish storefront design</Button>
      </div>

      <div className="designer-preview-wrap admin-surface">
        <div className="designer-preview-label"><span>Interactive selling-page preview</span><small>Drag the handles · {draft.catalog_locale === "vi" ? "Tiếng Việt" : "English"} · {draft.corner_radius ?? 16}px</small></div>
        <div className="designer-preview-stage">
          <CatalogLocaleProvider locale={draft.catalog_locale ?? "en"}>
            <div className="designer-live-storefront app-shell" style={getThemeStyle(draft)}>
              <CatalogHeader booth={draft} onOpenInfo={() => undefined} />
              <div className="catalog-layout storefront-layout-grid">
                {order.map((section) => <section key={section} className={`storefront-module storefront-module-${section} designer-live-module ${section === "booth" || section === "cart" ? "catalog-side" : "catalog-main"}`} onDragOver={(event) => event.preventDefault()} onDrop={() => dropOn(section)}><button type="button" className="designer-module-handle" draggable onDragStart={() => setDragged(section)} onDragEnd={() => setDragged(null)} aria-label={`Drag ${sectionMeta[section].title}`}><GripVertical size={15} />{sectionMeta[section].title}</button>{previewBlocks[section]}</section>)}
              </div>
            </div>
          </CatalogLocaleProvider>
        </div>
      </div>
    </section>
  );
}
