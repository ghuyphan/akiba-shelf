import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Languages,
  LayoutTemplate,
  Link2,
  Monitor,
  Palette,
  Save,
  Smartphone,
  Store,
  Type,
} from "lucide-react";
import type { BoothSettings, PaymentSettings, Product, StorefrontSection } from "../../types/catalog";
import { getThemeStyle } from "../../lib/theme";
import { CatalogLocaleProvider } from "../../lib/catalogI18n";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Field, TextArea, TextInput } from "../ui/Field";
import { CatalogHeader } from "../catalog/CatalogHeader";
import { CategoryFilters } from "../catalog/CategoryFilters";
import { CatalogToolbar } from "../catalog/CatalogToolbar";
import { ProductGrid } from "../catalog/ProductGrid";
import { StackedFeatured } from "../catalog/StackedFeatured";
import { BoothInfoPanel } from "../catalog/BoothInfoPanel";
import { SelectedItemPanel } from "../catalog/SelectedItemPanel";
import { ImageUpload } from "./ImageUpload";
import { QrManager } from "./QrManager";

type StorefrontDesignerProps = {
  settings: BoothSettings;
  products: Product[];
  payment: PaymentSettings;
  onSave: (settings: BoothSettings) => Promise<void>;
  onSavePayment: (settings: PaymentSettings) => Promise<void>;
};

type InspectorTab = "layout" | "content" | "style";
type PreviewDevice = "desktop" | "phone";

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

export function StorefrontDesigner({ settings, products, payment, onSave, onSavePayment }: StorefrontDesignerProps) {
  const [draft, setDraft] = useState(settings);
  const [dragged, setDragged] = useState<StorefrontSection | null>(null);
  const [selected, setSelected] = useState<StorefrontSection>("featured");
  const [tab, setTab] = useState<InspectorTab>("layout");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [previewScale, setPreviewScale] = useState(0.5);
  const previewStageRef = useRef<HTMLDivElement>(null);
  const [previewSearch, setPreviewSearch] = useState("");
  const [previewSort, setPreviewSort] = useState("recommended");
  const [previewView, setPreviewView] = useState<"grid" | "list">("grid");
  const { busy, error, run, setError } = useAsyncAction();
  const order = normalizedOrder(draft.layout_order);

  useEffect(() => { setDraft(settings); setError(""); }, [settings, setError]);

  useEffect(() => {
    const stage = previewStageRef.current;
    if (!stage) return undefined;
    const previewWidth = device === "phone" ? 390 : 1380;
    const updateScale = () => {
      const availableWidth = Math.max(0, stage.clientWidth - 28);
      setPreviewScale(Math.min(1, availableWidth / previewWidth));
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [device, sidebarOpen]);

  const previewProducts = useMemo(() => {
    const active = products.filter((product) => product.active).slice(0, 6);
    if (active.some((product) => product.featured) || active.length === 0) return active;
    return active.map((product, index) => index === 0 ? { ...product, featured: true } : product);
  }, [products]);
  const categories = useMemo(() => ["All", ...Array.from(new Set(previewProducts.map((product) => product.category))).filter(Boolean)], [previewProducts]);
  const previewCartProduct = previewProducts.find((product) => product.quantity_available > 0);
  function update<K extends keyof BoothSettings>(key: K, value: BoothSettings[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function move(section: StorefrontSection, target: StorefrontSection) {
    if (section === target) return;
    const next = order.filter((item) => item !== section);
    next.splice(next.indexOf(target), 0, section);
    update("layout_order", next);
  }

  function nudge(section: StorefrontSection, direction: -1 | 1) {
    const index = order.indexOf(section);
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    update("layout_order", next);
  }

  function dropOn(target: StorefrontSection) {
    if (dragged) move(dragged, target);
    setDragged(null);
  }

  function selectModule(section: StorefrontSection) {
    setSelected(section);
    setSidebarOpen(true);
    if (section === "booth" || section === "featured") setTab("content");
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
  const heroPreviewSections = order.filter((section) => section === "featured" || section === "booth");
  const mainPreviewSections = order.filter((section) => section === "controls" || section === "products");
  const sidePreviewSections = order.filter((section) => section === "cart");

  function renderModule(section: StorefrontSection) {
    return <div
      key={section}
      className={`storefront-module storefront-module-${section} designer-live-module ${selected === section ? "is-selected" : ""} ${dragged === section ? "is-dragging" : ""}`}
      onClick={(event) => { event.stopPropagation(); selectModule(section); }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => dropOn(section)}
    >
      <button type="button" className="designer-module-handle" draggable onDragStart={() => setDragged(section)} onDragEnd={() => setDragged(null)} aria-label={`Drag ${sectionMeta[section].title}`}><GripVertical size={15} />{sectionMeta[section].title}</button>
      {previewBlocks[section]}
    </div>;
  }

  return (
    <section className={`storefront-builder ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
      <aside className="builder-sidebar admin-surface">
        <div className="builder-sidebar-head">
          <span className="builder-logo"><LayoutTemplate size={18} /></span>
          {sidebarOpen && <div><strong>Storefront builder</strong><small>Click anything in the preview to edit it.</small></div>}
          <button type="button" className="builder-collapse" onClick={() => setSidebarOpen((open) => !open)} aria-label={sidebarOpen ? "Collapse builder sidebar" : "Expand builder sidebar"}>{sidebarOpen ? <ChevronLeft size={17} /> : <ChevronRight size={17} />}</button>
        </div>

        {sidebarOpen && <>
          <div className="builder-tabs" role="tablist" aria-label="Builder tools">
            {([['layout', LayoutTemplate, 'Layout'], ['content', Type, 'Content'], ['style', Palette, 'Style']] as const).map(([value, Icon, label]) => <button key={value} type="button" className={tab === value ? "active" : ""} onClick={() => setTab(value)}><Icon size={15} />{label}</button>)}
          </div>

          <div className="builder-inspector">
            {tab === "layout" && <>
              <div className="builder-section-heading"><div><strong>Page sections</strong><small>Drag to reorder the public page.</small></div></div>
              <div className="designer-block-list">
                {order.map((section, index) => <article key={section} draggable onClick={() => selectModule(section)} onDragStart={() => setDragged(section)} onDragEnd={() => setDragged(null)} onDragOver={(event) => event.preventDefault()} onDrop={() => dropOn(section)} className={`${dragged === section ? "dragging" : ""} ${selected === section ? "selected" : ""}`}><GripVertical size={17} /><span><strong>{sectionMeta[section].title}</strong><small>{sectionMeta[section].description}</small></span><em>{sectionMeta[section].size}</em><div><button type="button" disabled={index === 0} onClick={(event) => { event.stopPropagation(); nudge(section, -1); }} aria-label={`Move ${sectionMeta[section].title} up`}><ArrowUp size={14} /></button><button type="button" disabled={index === order.length - 1} onClick={(event) => { event.stopPropagation(); nudge(section, 1); }} aria-label={`Move ${sectionMeta[section].title} down`}><ArrowDown size={14} /></button></div></article>)}
              </div>
              <p className="builder-help">Wide and side modules keep safe column widths. Dragging changes their order within those responsive lanes.</p>
            </>}

            {tab === "content" && <div className="builder-fields">
              <div className="builder-section-heading"><div><strong>{sectionMeta[selected].title}</strong><small>Only settings for the selected section are shown.</small></div></div>
              {selected === "featured" && <p className="builder-empty-inspector">The Featured banner displays name, collection, price, and description details directly from your active featured products. Mark products as Featured to display them here.</p>}
              {selected === "booth" && <><div className="builder-field-group"><h3><Store size={15} /> Booth identity</h3><Field label="Booth name"><TextInput value={draft.booth_name} onChange={(event) => update("booth_name", event.target.value)} /></Field><Field label="Header subtitle"><TextInput value={draft.subtitle} onChange={(event) => update("subtitle", event.target.value)} /></Field><div className="builder-field-row"><Field label="Booth code"><TextInput value={draft.booth_code} onChange={(event) => update("booth_code", event.target.value)} /></Field><Field label="Open hours"><TextInput value={draft.open_hours} onChange={(event) => update("open_hours", event.target.value)} /></Field></div><Field label="Location"><TextInput value={draft.location} onChange={(event) => update("location", event.target.value)} /></Field><Field label="Logo URL"><TextInput value={draft.logo_url ?? ""} placeholder="https://…" onChange={(event) => update("logo_url", event.target.value)} /></Field><ImageUpload bucket="payment-qr" label="Upload booth logo" onUploaded={(url) => update("logo_url", url)} /></div><div className="builder-field-group"><h3><Link2 size={15} /> Social links</h3><Field label="Instagram URL"><TextInput type="url" value={draft.instagram_url ?? ""} onChange={(event) => update("instagram_url", event.target.value)} /></Field><Field label="Facebook URL"><TextInput type="url" value={draft.facebook_url ?? ""} onChange={(event) => update("facebook_url", event.target.value)} /></Field><Field label="TikTok URL"><TextInput type="url" value={draft.tiktok_url ?? ""} onChange={(event) => update("tiktok_url", event.target.value)} /></Field><Field label="Social QR center logo"><TextInput value={draft.social_qr_logo_url ?? ""} onChange={(event) => update("social_qr_logo_url", event.target.value)} /></Field></div></>}
              {selected === "cart" && <div className="builder-checkout-panel"><QrManager settings={payment} onSave={onSavePayment} /></div>}
              {selected === "controls" && <p className="builder-empty-inspector">Browse controls use the categories and product data from your catalog. Language is available under Style.</p>}
              {selected === "products" && <p className="builder-empty-inspector">Product content is managed from the Products workspace. This section follows the customer’s grid or list choice.</p>}
            </div>}

            {tab === "style" && <>
              <div className="builder-section-heading"><div><strong>Look & feel</strong><small>Changes update the canvas instantly.</small></div></div>
              <div className="designer-color-grid">{([['theme_primary','Primary','#6366f1'],['theme_secondary','Dark','#0f172a'],['theme_accent','Accent','#10b981'],['theme_background','Page','#f8fafc']] as const).map(([key,label,fallback]) => <label key={key}><span>{label}</span><div><input type="color" value={draft[key] ?? fallback} onChange={(event) => update(key, event.target.value)} /><code>{draft[key] ?? fallback}</code></div></label>)}</div>
              <div className="designer-setting-group"><div><Palette size={16} /><span><strong>Corner radius</strong><small>{draft.corner_radius ?? 16}px across storefront cards</small></span></div><input type="range" min="0" max="32" step="1" value={draft.corner_radius ?? 16} onChange={(event) => update("corner_radius", Number(event.target.value))} /></div>
              <div className="designer-locale"><Languages size={17} /><span><strong>Storefront language</strong><small>Customer-facing interface copy.</small></span><div><button type="button" className={(draft.catalog_locale ?? "en") === "en" ? "active" : ""} onClick={() => update("catalog_locale", "en")}>EN</button><button type="button" className={draft.catalog_locale === "vi" ? "active" : ""} onClick={() => update("catalog_locale", "vi")}>VI</button></div></div>
            </>}

          </div>

          <div className="builder-publish">
            {error && <Alert variant="error" title="Could not publish" onClose={() => setError("")}>{error}</Alert>}
            <Button icon={<Save size={17} />} loading={busy} loadingText="Publishing…" onClick={() => void save()}>Publish changes</Button>
          </div>
        </>}
      </aside>

      <div className="builder-canvas admin-surface">
        <div className="builder-toolbar">
          <div><strong>{sectionMeta[selected].title}</strong><small>Selected section</small></div>
          <div className="builder-device-switcher" aria-label="Preview size"><button type="button" className={device === "desktop" ? "active" : ""} onClick={() => setDevice("desktop")}><Monitor size={16} />Desktop</button><button type="button" className={device === "phone" ? "active" : ""} onClick={() => setDevice("phone")}><Smartphone size={16} />Phone</button></div>
          <span className="builder-status">Draft · Save when ready</span>
        </div>
        <div ref={previewStageRef} className={`designer-preview-stage device-${device}`}>
          <div className="designer-preview-frame" style={{ width: `${(device === "phone" ? 390 : 1380) * previewScale}px`, minHeight: `${(device === "phone" ? 844 : 1120) * previewScale}px` }}>
            <CatalogLocaleProvider locale={draft.catalog_locale ?? "en"}>
              <div className="designer-live-storefront app-shell" style={{ ...getThemeStyle(draft), transform: `scale(${previewScale})` }}>
                <CatalogHeader booth={draft} onOpenInfo={() => undefined} />
                <div className="catalog-layout storefront-layout-grid">
                  <div className="storefront-hero-grid">{heroPreviewSections.map(renderModule)}</div>
                  <div className="storefront-content-grid">
                    <section className="storefront-content-main">{mainPreviewSections.map(renderModule)}</section>
                    <section className="storefront-content-side">{sidePreviewSections.map(renderModule)}</section>
                  </div>
                </div>
              </div>
            </CatalogLocaleProvider>
          </div>
        </div>
      </div>
    </section>
  );
}
