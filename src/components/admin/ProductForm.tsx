import { FormEvent, useEffect, useState } from "react";
import { Boxes, Edit3, Eye, ImageIcon, PackagePlus, RotateCcw, Sparkles, Tags, Trash2, X } from "lucide-react";
import type { Product, StockStatus } from "../../types/catalog";
import { formatNumber, formatVnd, normalizeSlug } from "../../lib/format";
import { LIMITED_STOCK_THRESHOLD, productBadges } from "../../lib/constants";
import { validateProduct } from "../../lib/validation";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { useToast } from "../ui/ToastProvider";
import { Button } from "../ui/Button";
import { Field, TextArea, TextInput } from "../ui/Field";
import { SelectMenu } from "../ui/SelectMenu";
import { AdminCard } from "./AdminCard";
import { ImageUpload } from "./ImageUpload";
import { usePlatformI18n } from "../../lib/platformI18n";
import { QuantityInput } from "./QuantityInput";
import { getProductDiscountPercent, getProductPrice, isProductOnSale } from "../../lib/pricing";

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
  const { t } = usePlatformI18n();
  useEffect(() => { const message = saveError || deleteError; if (message) { toast.error(t(message), t("Could not update item")); setSaveError(""); setDeleteError(""); } }, [saveError, deleteError, setDeleteError, setSaveError, t, toast]);
  const isNewProduct = !product.name && !product.item_code;
  const hasLegacyBadge = Boolean(draft.badge) && !productBadges.includes(draft.badge ?? "");
  const images = draft.images.filter(Boolean);

  useEffect(() => { setDraft(product); setIsEditing(!product.name); setErrors([]); setSaveError(""); setDeleteError(""); }, [product, setDeleteError, setSaveError]);
  function setField<Key extends keyof Product>(key: Key, value: Product[Key]) { setDraft((current) => ({ ...current, [key]: value })); }
  function getFieldError(name: string) {
    const key = name === "item_code" ? "code" : name === "sale_price_vnd" ? "sale price" : name === "price_vnd" ? "price must" : name === "quantity_available" ? "quantity" : name;
    return errors.find((error) => error.toLowerCase().includes(key));
  }
  function resetDraft() { setDraft(product); setErrors([]); setSaveError(""); setDeleteError(""); setIsEditing(isNewProduct); }
  function setQuantity(quantity: number) {
    const status: StockStatus = quantity === 0 ? "sold_out" : quantity <= LIMITED_STOCK_THRESHOLD ? "limited" : "in_stock";
    setDraft((current) => ({ ...current, quantity_available: quantity, stock_status: status, stock_note: quantity === 0 ? "Sold out" : quantity <= LIMITED_STOCK_THRESHOLD ? "Limited stock" : "In stock" }));
  }
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
    if (!draft.id || !window.confirm(t("Delete “{{name}}”? This cannot be undone.", { name: draft.name }))) return;
    setSaveError("");
    await runDelete(() => onDelete(draft.id)).catch(() => undefined);
  }

  return (
    <AdminCard title={isNewProduct ? t("Create product") : draft.name || t("Product details")} description={isNewProduct ? t("Add the essentials first. You can refine the listing later.") : `${draft.item_code} · ${draft.category}`} icon={isNewProduct ? <PackagePlus size={18} /> : <Tags size={18} />} action={!isNewProduct && !isEditing ? <div className="admin-card-actions"><Button type="button" variant="secondary" icon={<Edit3 size={17} />} disabled={busy} onClick={() => setIsEditing(true)}>{t("Edit")}</Button><Button type="button" variant="danger" icon={<Trash2 size={17} />} loading={isDeleting} loadingText={t("Deleting…")} disabled={busy} onClick={handleDelete}>{t("Delete")}</Button></div> : undefined}>
      <form className={`admin-form admin-product-form ${isEditing ? "is-editing" : "is-readonly"}`} onSubmit={handleSubmit}>
        {!isEditing && <div className="admin-readout"><span><Tags size={16} /><small>{t("Price")}</small><strong>{formatVnd(getProductPrice(draft))}</strong>{isProductOnSale(draft) && <del>{formatVnd(draft.price_vnd)}</del>}</span><span><Boxes size={16} /><small>{t("Stock")}</small><strong>{formatNumber(draft.quantity_available)}</strong></span><span><Eye size={16} /><small>{t("Visibility")}</small><strong>{t(draft.active ? "Live" : "Hidden")}</strong></span></div>}

        <section className="admin-form-section">
          <div className="admin-form-section-heading"><span>01</span><div><h3>{t("Listing details")}</h3><p>{t("The information customers use to identify this item.")}</p></div></div>
          <div className="form-grid">
            <Field label={t("Product name · Required")} error={getFieldError("name") ? t(getFieldError("name")!) : undefined}><TextInput autoFocus={isNewProduct} placeholder={t("e.g. Moonlight acrylic stand")} value={draft.name} disabled={!isEditing} aria-invalid={Boolean(getFieldError("name"))} onChange={(event) => setField("name", event.target.value)} /></Field>
            <Field label={t("Item code · Required")} hint={t("A short unique code used by staff.")}><TextInput placeholder="e.g. AST-001" value={draft.item_code} disabled={!isEditing} aria-invalid={Boolean(getFieldError("item_code"))} onChange={(event) => setField("item_code", event.target.value.toUpperCase())} />{getFieldError("item_code") && <span className="field-error-msg">{t(getFieldError("item_code")!)}</span>}</Field>
            <Field label={t("Collection")} hint={t("Optional grouping, such as Spring 2026.")}><TextInput placeholder={t("e.g. Starry Days")} value={draft.collection} disabled={!isEditing} onChange={(event) => setField("collection", event.target.value)} /></Field>
            <Field label={t("Category · Required")} error={getFieldError("category") ? t(getFieldError("category")!) : undefined}><TextInput placeholder={t("e.g. Acrylic, Print, Apparel")} value={draft.category} disabled={!isEditing} aria-invalid={Boolean(getFieldError("category"))} onChange={(event) => setField("category", event.target.value)} /></Field>
          </div>
          <Field label={t("Description")} hint={isEditing ? t("{{count}}/500 characters", { count: draft.description.length }) : undefined}><TextArea maxLength={500} placeholder={t("What should customers know about this item?")} value={draft.description} disabled={!isEditing} onChange={(event) => setField("description", event.target.value)} /></Field>
        </section>

        <section className="admin-form-section">
          <div className="admin-form-section-heading"><span>02</span><div><h3>{t("Price & availability")}</h3><p>{t("Stock status updates automatically from the quantity.")}</p></div></div>
          <div className="form-grid">
            <Field label={t("Regular price · Required")} error={getFieldError("price_vnd") ? t(getFieldError("price_vnd")!) : undefined}><div className="admin-input-affix"><TextInput type="text" inputMode="numeric" placeholder="0" value={formatDisplayPrice(draft.price_vnd)} disabled={!isEditing} aria-invalid={Boolean(getFieldError("price_vnd"))} onChange={(event) => { const raw = event.target.value.replace(/\D/g, ""); setField("price_vnd", raw ? Number(raw) : 0); }} /><span>VND</span></div></Field>
            {draft.sale_price_vnd != null && <Field label={t("Sale price · Required")} hint={draft.price_vnd > 0 && draft.sale_price_vnd < draft.price_vnd ? t("Customers save {{percent}}%.", { percent: getProductDiscountPercent(draft) }) : t("Must be lower than the regular price.")} error={getFieldError("sale_price_vnd") ? t(getFieldError("sale_price_vnd")!) : undefined}><div className="admin-input-affix"><TextInput type="text" inputMode="numeric" placeholder="0" value={formatDisplayPrice(draft.sale_price_vnd)} disabled={!isEditing} aria-invalid={Boolean(getFieldError("sale_price_vnd"))} onChange={(event) => { const raw = event.target.value.replace(/\D/g, ""); setField("sale_price_vnd", raw ? Number(raw) : 0); }} /><span>VND</span></div></Field>}
            <Field label={t("Quantity")} error={getFieldError("quantity_available") ? t(getFieldError("quantity_available")!) : undefined}><QuantityInput value={draft.quantity_available} disabled={!isEditing} invalid={Boolean(getFieldError("quantity_available"))} onChange={setQuantity} /></Field>
            <Field label={t("Customer badge")} hint={t("Optional label shown on product artwork.")}><SelectMenu label={t("Customer badge")} value={draft.badge ?? ""} disabled={!isEditing} onChange={(value) => setField("badge", value)} options={[{ value: "", label: t("No badge") }, ...(hasLegacyBadge ? [{ value: draft.badge ?? "", label: draft.badge ?? "" }] : []), ...productBadges.map((badge) => ({ value: badge, label: t(badge), icon: <Sparkles size={14} /> }))]} />{draft.badge && <div className="admin-badge-customizer"><span className="admin-color-well" title={t("Choose badge color")}><input type="color" aria-label={t("Badge color")} value={draft.badge_color || "#5f8d55"} disabled={!isEditing} onChange={(event) => setField("badge_color", event.target.value)} /><span style={{ background: draft.badge_color || "#5f8d55" }} /></span><span className="admin-badge-preview" style={{ background: draft.badge_color || "#5f8d55" }}><Sparkles size={12} />{t(draft.badge)}</span></div>}</Field>
          </div>
          <div className="admin-switch-row"><label><span><strong>{t("Put this item on sale")}</strong><small>{t("Show a lower price while keeping the regular price visible.")}</small></span><input type="checkbox" checked={draft.sale_price_vnd != null} disabled={!isEditing} onChange={(event) => setField("sale_price_vnd", event.target.checked ? Math.max(0, draft.price_vnd - 10_000) : null)} /></label><label><span><strong>{t("Feature this item")}</strong><small>{t("Give it extra prominence on the storefront.")}</small></span><input type="checkbox" checked={draft.featured} disabled={!isEditing} onChange={(event) => setField("featured", event.target.checked)} /></label><label><span><strong>{t("Visible in catalog")}</strong><small>{t("Customers can find and purchase this item.")}</small></span><input type="checkbox" checked={draft.active} disabled={!isEditing} onChange={(event) => setField("active", event.target.checked)} /></label></div>
        </section>

        <section className="admin-form-section">
          <div className="admin-form-section-heading"><span>03</span><div><h3>{t("Product gallery")}</h3><p>{t("Add up to four images. The first image becomes the cover.")}</p></div></div>
          <div className="admin-image-gallery">
            {images.map((image, index) => <div className="admin-image-tile" key={`${image}-${index}`}><img src={image} alt={`${draft.name || t("Product")} ${index + 1}`} />{index === 0 && <span>{t("Cover")}</span>}{isEditing && <button type="button" onClick={() => removeImage(index)} aria-label={t("Remove image {{number}}", { number: index + 1 })}><X size={15} /></button>}</div>)}
            {images.length === 0 && <div className="admin-image-empty"><ImageIcon size={25} /><span>{t("No product images yet")}</span></div>}
            {isEditing && images.length < 4 && <div className="admin-image-upload-tile"><ImageUpload shopId={shopId} bucket="product-images" label={images.length ? t("Add another image") : t("Upload product image")} onUploaded={(url) => setField("images", [...images, url])} onProductUploaded={(variant) => setDraft((current) => ({ ...current, images: [...current.images.filter(Boolean), variant.detail], image_variants: [...(current.image_variants ?? []), { thumbnail: variant.thumbnail, detail: variant.detail }], image_paths: [...(current.image_paths ?? []), ...variant.paths] }))} /></div>}
          </div>
          {getFieldError("images") && <div className="field-error-msg admin-gallery-error">{t(getFieldError("images")!)}</div>}
        </section>

        {isEditing && <div className="admin-sticky-actions"><Button type="submit" loading={isSaving} loadingText={t("Saving…")} disabled={busy}>{isNewProduct ? t("Create product") : t("Save changes")}</Button><Button type="button" variant="secondary" icon={isNewProduct ? <RotateCcw size={17} /> : <X size={17} />} disabled={busy} onClick={resetDraft}>{isNewProduct ? t("Clear") : t("Cancel")}</Button></div>}
      </form>
    </AdminCard>
  );
}
