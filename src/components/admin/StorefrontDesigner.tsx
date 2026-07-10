import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Languages, LayoutTemplate, Palette, Save } from "lucide-react";
import type { BoothSettings, StorefrontSection } from "../../types/catalog";
import { getThemeStyle } from "../../lib/theme";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";

type StorefrontDesignerProps = { settings: BoothSettings; onSave: (settings: BoothSettings) => Promise<void> };

const sectionMeta: Record<StorefrontSection, { title: string; description: string }> = {
  featured: { title: "Featured spotlight", description: "Promoted products and swipe deck" },
  controls: { title: "Browse controls", description: "Categories, search, sort, and view mode" },
  products: { title: "Product collection", description: "The complete item grid or list" },
};

function normalizedOrder(order?: StorefrontSection[]) {
  const allowed: StorefrontSection[] = ["featured", "controls", "products"];
  return order?.length === allowed.length && allowed.every((item) => order.includes(item)) ? order : allowed;
}

export function StorefrontDesigner({ settings, onSave }: StorefrontDesignerProps) {
  const [draft, setDraft] = useState(settings);
  const [dragged, setDragged] = useState<StorefrontSection | null>(null);
  const { busy, error, run, setError } = useAsyncAction();
  const order = normalizedOrder(draft.layout_order);

  useEffect(() => { setDraft(settings); setError(""); }, [settings, setError]);

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

  async function save() { await run(() => onSave({ ...draft, layout_order: order })).catch(() => undefined); }

  return (
    <section className="storefront-designer">
      <div className="designer-controls">
        <div className="designer-panel-heading"><span><LayoutTemplate size={18} /></span><div><h2>Layout builder</h2><p>Drag the storefront blocks into the order customers should see them.</p></div></div>
        <div className="designer-block-list">
          {order.map((section, index) => <article key={section} draggable onDragStart={() => setDragged(section)} onDragEnd={() => setDragged(null)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragged) move(dragged, section); setDragged(null); }} className={dragged === section ? "dragging" : ""}><GripVertical size={17} /><span><strong>{sectionMeta[section].title}</strong><small>{sectionMeta[section].description}</small></span><div><button type="button" disabled={index === 0} onClick={() => nudge(section, -1)} aria-label={`Move ${sectionMeta[section].title} up`}><ArrowUp size={14} /></button><button type="button" disabled={index === order.length - 1} onClick={() => nudge(section, 1)} aria-label={`Move ${sectionMeta[section].title} down`}><ArrowDown size={14} /></button></div></article>)}
        </div>

        <div className="designer-setting-group"><div><Palette size={16} /><span><strong>Corner radius</strong><small>{draft.corner_radius ?? 16}px across storefront cards</small></span></div><input type="range" min="0" max="32" step="1" value={draft.corner_radius ?? 16} onChange={(event) => setDraft({ ...draft, corner_radius: Number(event.target.value) })} /></div>
        <div className="designer-color-grid">{([['theme_primary','Primary','#6366f1'],['theme_secondary','Dark','#0f172a'],['theme_accent','Accent','#10b981'],['theme_background','Page','#f8fafc']] as const).map(([key,label,fallback]) => <label key={key}><span>{label}</span><div><input type="color" value={draft[key] ?? fallback} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /><code>{draft[key] ?? fallback}</code></div></label>)}</div>
        <div className="designer-locale"><Languages size={17} /><span><strong>Storefront language</strong><small>Applies to customer-facing interface copy.</small></span><div><button type="button" className={(draft.catalog_locale ?? "en") === "en" ? "active" : ""} onClick={() => setDraft({ ...draft, catalog_locale: "en" })}>EN</button><button type="button" className={draft.catalog_locale === "vi" ? "active" : ""} onClick={() => setDraft({ ...draft, catalog_locale: "vi" })}>VI</button></div></div>
        {error && <Alert variant="error" title="Could not save storefront" onClose={() => setError("")}>{error}</Alert>}
        <Button icon={<Save size={17} />} loading={busy} loadingText="Saving…" onClick={() => void save()}>Publish storefront design</Button>
      </div>

      <div className="designer-preview-wrap">
        <div className="designer-preview-label"><span>Live preview</span><small>{draft.catalog_locale === "vi" ? "Tiếng Việt" : "English"} · {draft.corner_radius ?? 16}px</small></div>
        <div className="designer-preview" style={{ ...getThemeStyle(draft), borderRadius: `calc(var(--store-radius) + 8px)` }}>
          <header><i style={{ background: "var(--coral)" }} /><span><strong>{draft.booth_name || "Your booth"}</strong><small>{draft.booth_code || "BOOTH"}</small></span></header>
          <main>{order.map((section) => section === "featured" ? <div key={section} className="preview-feature"><span><small>{draft.catalog_locale === "vi" ? "Nổi bật" : "Featured"}</small><strong>{draft.hero_title || "Featured collection"}</strong></span><i /></div> : section === "controls" ? <div key={section} className="preview-controls"><i /><i /><i /></div> : <div key={section} className="preview-products"><i /><i /><i /><i /></div>)}</main>
        </div>
      </div>
    </section>
  );
}
