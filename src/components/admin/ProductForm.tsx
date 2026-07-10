import { FormEvent, useEffect, useState } from "react";
import { Boxes, Edit3, Eye, ImageIcon, PackagePlus, RotateCcw, Tags, Trash2, X } from "lucide-react";
import type { Product, StockStatus } from "../../types/catalog";
import { formatNumber, formatVnd, normalizeSlug } from "../../lib/format";
import { productBadges } from "../../lib/constants";
import { validateProduct } from "../../lib/validation";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Field, SelectInput, TextArea, TextInput } from "../ui/Field";
import { AdminCard } from "./AdminCard";
import { ImageUpload } from "./ImageUpload";

function formatDisplayPrice(value: number | string): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? new Intl.NumberFormat("vi-VN").format(Number(digits)) : "";
}

type ProductFormProps = { product: Product; onSave: (product: Product) => Promise<void>; onDelete: (id: string) => Promise<void> };

export function ProductForm({ product, onSave, onDelete }: ProductFormProps) {
  const [draft, setDraft] = useState(product);
  const [isEditing, setIsEditing] = useState(!product.name);
  const [errors, setErrors] = useState<string[]>([]);
  const { busy: isSaving, error: saveError, run: runSave, setError: setSaveError } = useAsyncAction();
  const { busy: isDeleting, error: deleteError, run: runDelete, setError: setDeleteError } = useAsyncAction();
  const busy = isSaving || isDeleting;
  const isNewProduct = !product.name && !product.item_code;
  const hasLegacyBadge = Boolean(draft.badge) && !productBadges.includes(draft.badge ?? "");
  const images = draft.images.filter(Boolean);

  useEffect(() => { setDraft(product); setIsEditing(!product.name); setErrors([]); setSaveError(""); setDeleteError(""); }, [product]);
  function setField<Key extends keyof Product>(key: Key, value: Product[Key]) { setDraft((current) => ({ ...current, [key]: value })); }
  function getFieldError(name: string) { return errors.find((error) => error.toLowerCase().includes(name === "item_code" ? "code" : name === "price_vnd" ? "price" : name === "quantity_available" ? "quantity" : name)); }
  function resetDraft() { setDraft(product); setErrors([]); setSaveError(""); setDeleteError(""); setIsEditing(isNewProduct); }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isEditing) return;
    const nextErrors = validateProduct(draft);
    setErrors(nextErrors);
    if (nextErrors.length) return;
    let didSave = false;
    setDeleteError("");
    await runSave(async () => { await onSave({ ...draft, id: draft.id || normalizeSlug(`${draft.item_code}-${draft.name}`) }); didSave = true; }).catch(() => undefined);
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
            <Field label="Name" error={getFieldError("name")}><TextInput value={draft.name} disabled={!isEditing} onChange={(event) => setField("name", event.target.value)} /></Field>
            <Field label="Item code" error={getFieldError("item_code")}><TextInput value={draft.item_code} disabled={!isEditing} onChange={(event) => setField("item_code", event.target.value)} /></Field>
            <Field label="Collection"><TextInput value={draft.collection} disabled={!isEditing} onChange={(event) => setField("collection", event.target.value)} /></Field>
            <Field label="Category" error={getFieldError("category")}><TextInput value={draft.category} disabled={!isEditing} onChange={(event) => setField("category", event.target.value)} /></Field>
          </div>
          <Field label="Description"><TextArea value={draft.description} disabled={!isEditing} onChange={(event) => setField("description", event.target.value)} /></Field>
        </section>

        <section className="admin-form-section">
          <div className="admin-form-section-heading"><span>02</span><div><h3>Price & availability</h3><p>Stock status updates automatically from the quantity.</p></div></div>
          <div className="form-grid">
            <Field label="Price (VND)" error={getFieldError("price_vnd")}><TextInput type="text" inputMode="numeric" value={formatDisplayPrice(draft.price_vnd)} disabled={!isEditing} onChange={(event) => { const raw = event.target.value.replace(/\D/g, ""); setField("price_vnd", raw ? Number(raw) : 0); }} /></Field>
            <Field label="Quantity" hint={isEditing ? `${formatNumber(draft.quantity_available)} units` : undefined} error={getFieldError("quantity_available")}><TextInput type="number" min="0" step="1" value={draft.quantity_available} disabled={!isEditing} onChange={(event) => { const qty = Math.max(0, Math.floor(Number(event.target.value) || 0)); const status: StockStatus = qty === 0 ? "sold_out" : qty <= 5 ? "limited" : "in_stock"; setDraft((current) => ({ ...current, quantity_available: qty, stock_status: status, stock_note: qty === 0 ? "Sold out" : qty <= 5 ? "Limited stock" : "In stock" })); }} /></Field>
            <Field label="Badge"><SelectInput value={draft.badge ?? ""} disabled={!isEditing} onChange={(event) => setField("badge", event.target.value)}><option value="">No badge</option>{hasLegacyBadge && <option value={draft.badge}>{draft.badge}</option>}{productBadges.map((badge) => <option key={badge} value={badge}>{badge}</option>)}</SelectInput>{draft.badge && <span className="admin-badge-preview">{draft.badge}</span>}</Field>
          </div>
          <div className="admin-switch-row"><label><input type="checkbox" checked={draft.featured} disabled={!isEditing} onChange={(event) => setField("featured", event.target.checked)} /> Featured item</label><label><input type="checkbox" checked={draft.active} disabled={!isEditing} onChange={(event) => setField("active", event.target.checked)} /> Visible in catalog</label></div>
        </section>

        <section className="admin-form-section">
          <div className="admin-form-section-heading"><span>03</span><div><h3>Product gallery</h3><p>Add up to four images. The first image becomes the cover.</p></div></div>
          <div className="admin-image-gallery">
            {images.map((image, index) => <div className="admin-image-tile" key={`${image}-${index}`}><img src={image} alt={`${draft.name || "Product"} ${index + 1}`} />{index === 0 && <span>Cover</span>}{isEditing && <button type="button" onClick={() => setField("images", images.filter((_, imageIndex) => imageIndex !== index))} aria-label={`Remove image ${index + 1}`}><X size={15} /></button>}</div>)}
            {images.length === 0 && <div className="admin-image-empty"><ImageIcon size={25} /><span>No product images yet</span></div>}
            {isEditing && images.length < 4 && <div className="admin-image-upload-tile"><ImageUpload bucket="product-images" label={images.length ? "Add another image" : "Upload product image"} onUploaded={(url) => setField("images", [...images, url])} /></div>}
          </div>
          {getFieldError("images") && <div className="field-error-msg">{getFieldError("images")}</div>}
        </section>

        {(saveError || deleteError) && <Alert variant="error" title="Could not update item" onClose={() => { setSaveError(""); setDeleteError(""); }}>{saveError || deleteError}</Alert>}
        {isEditing && <div className="admin-sticky-actions"><Button type="submit" loading={isSaving} loadingText="Saving…" disabled={busy}>{isNewProduct ? "Create product" : "Save changes"}</Button><Button type="button" variant="secondary" icon={isNewProduct ? <RotateCcw size={17} /> : <X size={17} />} disabled={busy} onClick={resetDraft}>{isNewProduct ? "Clear" : "Cancel"}</Button></div>}
      </form>
    </AdminCard>
  );
}
