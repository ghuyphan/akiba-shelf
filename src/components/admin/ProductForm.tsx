import { FormEvent, useEffect, useState } from "react";
import { Boxes, Edit3, Eye, ImageIcon, PackagePlus, RotateCcw, Sparkles, Tags, Trash2, X } from "lucide-react";
import type { Product, StockStatus } from "../../types/catalog";
import { formatNumber, formatVnd, normalizeSlug } from "../../lib/format";
import { LIMITED_STOCK_THRESHOLD, productBadges } from "../../lib/constants";
import { validateProduct } from "../../lib/validation";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { useToast } from "../ui/ToastProvider";
import { Button } from "../ui/Button";
import { Field, SelectInput, TextArea, TextInput } from "../ui/Field";
import { AdminCard } from "./AdminCard";
import { ImageUpload } from "./ImageUpload";

function formatDisplayPrice(value: number | string): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? new Intl.NumberFormat("vi-VN").format(Number(digits)) : "";
}

type ProductFormProps = { shopId: string; product: Product; onSave: (product: Product) => Promise<void>; onDelete: (id: string) => Promise<void> };

export function ProductForm({ shopId, product, onSave, onDelete }: ProductFormProps) {
  const [draft, setDraft] = useState(product);
  const [isEditing, setIsEditing] = useState(!product.name);
  const [errors, setErrors] = useState<string[]>([]);
  const { busy: isSaving, error: saveError, run: runSave, setError: setSaveError } = useAsyncAction();
  const { busy: isDeleting, error: deleteError, run: runDelete, setError: setDeleteError } = useAsyncAction();
  const busy = isSaving || isDeleting;
  const toast = useToast();
  useEffect(() => { const message = saveError || deleteError; if (message) { toast.error(message, "Could not update item"); setSaveError(""); setDeleteError(""); } }, [saveError, deleteError, setDeleteError, setSaveError, toast]);
  const isNewProduct = !product.name && !product.item_code;
  const hasLegacyBadge = Boolean(draft.badge) && !productBadges.includes(draft.badge ?? "");
  const images = draft.images.filter(Boolean);

  useEffect(() => { setDraft(product); setIsEditing(!product.name); setErrors([]); setSaveError(""); setDeleteError(""); }, [product, setDeleteError, setSaveError]);
  function setField<Key extends keyof Product>(key: Key, value: Product[Key]) { setDraft((current) => ({ ...current, [key]: value })); }
  function getFieldError(name: string) { return errors.find((error) => error.toLowerCase().includes(name === "item_code" ? "code" : name === "price_vnd" ? "price" : name === "quantity_available" ? "quantity" : name)); }
  function resetDraft() { setDraft(product); setErrors([]); setSaveError(""); setDeleteError(""); setIsEditing(isNewProduct); }
  function removeImage(index: number) {
    setDraft((current) => {
      const variants = current.image_variants ?? [];
      const paths = current.image_paths ?? [];
      return {
        ...current,
        images: current.images.filter((_, imageIndex) => imageIndex !== index),
        image_variants: variants.length === current.images.filter(Boolean).length ? variants.filter((_, imageIndex) => imageIndex !== index) : variants,
        image_paths: variants.length === current.images.filter(Boolean).length ? paths.filter((_, pathIndex) => Math.floor(pathIndex / 2) !== index) : paths,
      };
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isEditing) return;
    const quantity = Math.max(0, Math.floor(Number(draft.quantity_available) || 0));
    const normalizedDraft: Product = {
      ...draft,
      name: draft.name.trim(),
      item_code: draft.item_code.trim().toUpperCase(),
      collection: draft.collection.trim(),
      category: draft.category.trim(),
      description: draft.description.trim(),
      images,
      quantity_available: quantity,
      stock_status: quantity === 0 ? "sold_out" : quantity <= LIMITED_STOCK_THRESHOLD ? "limited" : "in_stock",
      stock_note: quantity === 0 ? "Sold out" : quantity <= LIMITED_STOCK_THRESHOLD ? "Limited stock" : "In stock",
    };
    const nextErrors = validateProduct(normalizedDraft);
    setErrors(nextErrors);
    if (nextErrors.length) return;
    let didSave = false;
    setDeleteError("");
    await runSave(async () => { await onSave({ ...normalizedDraft, id: normalizedDraft.id || normalizeSlug(`${normalizedDraft.item_code}-${normalizedDraft.name}`) }); didSave = true; }).catch(() => undefined);
    if (didSave) setIsEditing(false);
  }

  async function handleDelete() {
    if (!draft.id || !window.confirm(`Delete “${draft.name}”? This cannot be undone.`)) return;
    setSaveError("");
    await runDelete(() => onDelete(draft.id)).catch(() => undefined);
  }

  return (
    <AdminCard title={isNewProduct ? "Create product" : draft.name || "Product details"} description={isNewProduct ? "Add the essentials first. You can refine the listing later." : `${draft.item_code} · ${draft.category}`} icon={isNewProduct ? <PackagePlus size={18} /> : <Tags size={18} />} action={!isNewProduct && !isEditing ? <div className="admin-card-actions"><Button type="button" variant="secondary" icon={<Edit3 size={17} />} disabled={busy} onClick={() => setIsEditing(true)}>Edit</Button><Button type="button" variant="danger" icon={<Trash2 size={17} />} loading={isDeleting} loadingText="Deleting…" disabled={busy} onClick={handleDelete}>Delete</Button></div> : undefined}>
      <form className="admin-form admin-product-form" onSubmit={handleSubmit}>
        {!isEditing && <div className="admin-readout"><span><Tags size={16} /><small>Price</small><strong>{formatVnd(draft.price_vnd)}</strong></span><span><Boxes size={16} /><small>Stock</small><strong>{formatNumber(draft.quantity_available)}</strong></span><span><Eye size={16} /><small>Visibility</small><strong>{draft.active ? "Live" : "Hidden"}</strong></span></div>}

        <section className="admin-form-section">
          <div className="admin-form-section-heading"><span>01</span><div><h3>Listing details</h3><p>The information customers use to identify this item.</p></div></div>
          <div className="form-grid">
            <Field label="Product name · Required" error={getFieldError("name")}><TextInput autoFocus={isNewProduct} placeholder="e.g. Moonlight acrylic stand" value={draft.name} disabled={!isEditing} aria-invalid={Boolean(getFieldError("name"))} onChange={(event) => setField("name", event.target.value)} /></Field>
            <Field label="Item code · Required" hint="A short unique code used by staff."><TextInput placeholder="e.g. AST-001" value={draft.item_code} disabled={!isEditing} aria-invalid={Boolean(getFieldError("item_code"))} onChange={(event) => setField("item_code", event.target.value.toUpperCase())} />{getFieldError("item_code") && <span className="field-error-msg">{getFieldError("item_code")}</span>}</Field>
            <Field label="Collection" hint="Optional grouping, such as Spring 2026."><TextInput placeholder="e.g. Starry Days" value={draft.collection} disabled={!isEditing} onChange={(event) => setField("collection", event.target.value)} /></Field>
            <Field label="Category · Required" error={getFieldError("category")}><TextInput placeholder="e.g. Acrylic, Print, Apparel" value={draft.category} disabled={!isEditing} aria-invalid={Boolean(getFieldError("category"))} onChange={(event) => setField("category", event.target.value)} /></Field>
          </div>
          <Field label="Description" hint={isEditing ? `${draft.description.length}/500 characters` : undefined}><TextArea maxLength={500} placeholder="What should customers know about this item?" value={draft.description} disabled={!isEditing} onChange={(event) => setField("description", event.target.value)} /></Field>
        </section>

        <section className="admin-form-section">
          <div className="admin-form-section-heading"><span>02</span><div><h3>Price & availability</h3><p>Stock status updates automatically from the quantity.</p></div></div>
          <div className="form-grid">
            <Field label="Price · Required" error={getFieldError("price_vnd")}><div className="admin-input-affix"><TextInput type="text" inputMode="numeric" placeholder="0" value={formatDisplayPrice(draft.price_vnd)} disabled={!isEditing} aria-invalid={Boolean(getFieldError("price_vnd"))} onChange={(event) => { const raw = event.target.value.replace(/\D/g, ""); setField("price_vnd", raw ? Number(raw) : 0); }} /><span>VND</span></div></Field>
            <Field label="Quantity" error={getFieldError("quantity_available")}><TextInput type="number" min="0" step="1" value={draft.quantity_available} disabled={!isEditing} onChange={(event) => { const qty = Math.max(0, Math.floor(Number(event.target.value) || 0)); const status: StockStatus = qty === 0 ? "sold_out" : qty <= LIMITED_STOCK_THRESHOLD ? "limited" : "in_stock"; setDraft((current) => ({ ...current, quantity_available: qty, stock_status: status, stock_note: qty === 0 ? "Sold out" : qty <= LIMITED_STOCK_THRESHOLD ? "Limited stock" : "In stock" })); }} /></Field>
            <Field label="Customer badge" hint="Optional label shown on product artwork."><SelectInput value={draft.badge ?? ""} disabled={!isEditing} onChange={(event) => setField("badge", event.target.value)}><option value="">No badge</option>{hasLegacyBadge && <option value={draft.badge}>{draft.badge}</option>}{productBadges.map((badge) => <option key={badge} value={badge}>{badge}</option>)}</SelectInput>{draft.badge && <div className="admin-badge-customizer"><span className="admin-color-well" title="Choose badge color"><input type="color" aria-label="Badge color" value={draft.badge_color || "#5f8d55"} disabled={!isEditing} onChange={(event) => setField("badge_color", event.target.value)} /><span style={{ background: draft.badge_color || "#5f8d55" }} /></span><span className="admin-badge-preview" style={{ background: draft.badge_color || "#5f8d55" }}><Sparkles size={12} />{draft.badge}</span></div>}</Field>
          </div>
          <div className="admin-switch-row"><label><span><strong>Feature this item</strong><small>Give it extra prominence on the storefront.</small></span><input type="checkbox" checked={draft.featured} disabled={!isEditing} onChange={(event) => setField("featured", event.target.checked)} /></label><label><span><strong>Visible in catalog</strong><small>Customers can find and purchase this item.</small></span><input type="checkbox" checked={draft.active} disabled={!isEditing} onChange={(event) => setField("active", event.target.checked)} /></label></div>
        </section>

        <section className="admin-form-section">
          <div className="admin-form-section-heading"><span>03</span><div><h3>Product gallery</h3><p>Add up to four images. The first image becomes the cover.</p></div></div>
          <div className="admin-image-gallery">
            {images.map((image, index) => <div className="admin-image-tile" key={`${image}-${index}`}><img src={image} alt={`${draft.name || "Product"} ${index + 1}`} />{index === 0 && <span>Cover</span>}{isEditing && <button type="button" onClick={() => removeImage(index)} aria-label={`Remove image ${index + 1}`}><X size={15} /></button>}</div>)}
            {images.length === 0 && <div className="admin-image-empty"><ImageIcon size={25} /><span>No product images yet</span></div>}
            {isEditing && images.length < 4 && <div className="admin-image-upload-tile"><ImageUpload shopId={shopId} bucket="product-images" label={images.length ? "Add another image" : "Upload product image"} onUploaded={(url) => setField("images", [...images, url])} onProductUploaded={(variant) => setDraft((current) => ({ ...current, images: [...current.images.filter(Boolean), variant.detail], image_variants: [...(current.image_variants ?? []), { thumbnail: variant.thumbnail, detail: variant.detail }], image_paths: [...(current.image_paths ?? []), ...variant.paths] }))} /></div>}
          </div>
          {getFieldError("images") && <div className="field-error-msg admin-gallery-error">{getFieldError("images")}</div>}
        </section>

        {isEditing && <div className="admin-sticky-actions"><Button type="submit" loading={isSaving} loadingText="Saving…" disabled={busy}>{isNewProduct ? "Create product" : "Save changes"}</Button><Button type="button" variant="secondary" icon={isNewProduct ? <RotateCcw size={17} /> : <X size={17} />} disabled={busy} onClick={resetDraft}>{isNewProduct ? "Clear" : "Cancel"}</Button></div>}
      </form>
    </AdminCard>
  );
}
