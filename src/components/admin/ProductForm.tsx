import { FormEvent, useEffect, useState } from "react";
import { Boxes, Edit3, Eye, PackagePlus, RotateCcw, Tags, Trash2, X } from "lucide-react";
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

type ProductFormProps = {
  product: Product;
  onSave: (product: Product) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function ProductForm({ product, onSave, onDelete }: ProductFormProps) {
  const [draft, setDraft] = useState(product);
  const [isEditing, setIsEditing] = useState(!product.name);
  const [errors, setErrors] = useState<string[]>([]);
  const { busy: isSaving, error: saveError, run: runSave, setError: setSaveError } = useAsyncAction();
  const { busy: isDeleting, error: deleteError, run: runDelete, setError: setDeleteError } = useAsyncAction();
  const primaryImage = draft.images.find(Boolean);
  const asyncError = saveError || deleteError;
  const busy = isSaving || isDeleting;
  const isNewProduct = !product.name && !product.item_code;
  const hasLegacyBadge = Boolean(draft.badge) && !productBadges.includes(draft.badge ?? "");

  const getFieldError = (fieldName: string) => {
    switch (fieldName) {
      case "name":
        return errors.find((e) => e.toLowerCase().includes("name"));
      case "item_code":
        return errors.find((e) => e.toLowerCase().includes("code"));
      case "category":
        return errors.find((e) => e.toLowerCase().includes("category"));
      case "price_vnd":
        return errors.find((e) => e.toLowerCase().includes("price"));
      case "quantity_available":
        return errors.find((e) => e.toLowerCase().includes("quantity"));
      case "images":
        return errors.find((e) => e.toLowerCase().includes("image"));
      default:
        return undefined;
    }
  };

  useEffect(() => {
    setDraft(product);
    setIsEditing(!product.name);
    setErrors([]);
    setSaveError("");
    setDeleteError("");
  }, [product]);

  function setField<Key extends keyof Product>(key: Key, value: Product[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function readNumber(value: string) {
    if (value.trim() === "") return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function resetDraft() {
    setDraft(product);
    setErrors([]);
    setSaveError("");
    setDeleteError("");
    setIsEditing(isNewProduct);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isEditing) return;
    const nextErrors = validateProduct(draft);
    setErrors(nextErrors);
    if (nextErrors.length > 0) return;

    setDeleteError("");
    let didSave = false;
    await runSave(async () => {
      const finalProduct = {
        ...draft,
        id: draft.id || normalizeSlug(`${draft.item_code}-${draft.name}`),
      };
      await onSave(finalProduct);
      didSave = true;
    }).catch(() => undefined);
    if (!didSave) return;
    setIsEditing(false);
  }

  async function handleDelete() {
    if (!draft.id) return;
    setSaveError("");
    await runDelete(() => onDelete(draft.id)).catch(() => undefined);
  }

  return (
    <AdminCard
      title={isNewProduct ? "New Item" : "Item Details"}
      description={isNewProduct ? "Add the item details, image, and stock before saving." : "Review details, then edit only when changes are needed."}
      icon={isNewProduct ? <PackagePlus size={18} /> : <Tags size={18} />}
      action={
        !isNewProduct && !isEditing ? (
          <div className="admin-card-actions">
            <Button type="button" variant="secondary" icon={<Edit3 size={18} />} disabled={busy} onClick={() => setIsEditing(true)}>
              Edit
            </Button>
            <Button
              type="button"
              variant="danger"
              icon={<Trash2 size={18} />}
              loading={isDeleting}
              loadingText="Deleting..."
              disabled={busy}
              onClick={handleDelete}
            >
              Delete
            </Button>
          </div>
        ) : undefined
      }
    >
      <form className="admin-form" onSubmit={handleSubmit}>
        {!isEditing && (
          <div className="admin-readout" aria-label="Selected item summary">
            <span>
              <Tags size={16} />
              <small>Price</small>
              <strong>{formatVnd(draft.price_vnd)}</strong>
            </span>
            <span>
              <Boxes size={16} />
              <small>Quantity</small>
              <strong>{formatNumber(draft.quantity_available)}</strong>
            </span>
            <span>
              <Eye size={16} />
              <small>Status</small>
              <strong>{draft.active ? "Visible" : "Hidden"}</strong>
            </span>
          </div>
        )}
        <div className="form-grid">
          <Field label="Name" error={getFieldError("name")}>
            <TextInput value={draft.name} disabled={!isEditing} onChange={(event) => setField("name", event.target.value)} />
          </Field>
          <Field label="Item Code" error={getFieldError("item_code")}>
            <TextInput value={draft.item_code} disabled={!isEditing} onChange={(event) => setField("item_code", event.target.value)} />
          </Field>
          <Field label="Collection">
            <TextInput value={draft.collection} disabled={!isEditing} onChange={(event) => setField("collection", event.target.value)} />
          </Field>
          <Field label="Category" error={getFieldError("category")}>
            <TextInput value={draft.category} disabled={!isEditing} onChange={(event) => setField("category", event.target.value)} />
          </Field>
          <Field label="Price VND" hint={isEditing ? formatVnd(draft.price_vnd) : undefined} error={getFieldError("price_vnd")}>
            <TextInput
              type="number"
              min="0"
              step="1000"
              value={draft.price_vnd}
              disabled={!isEditing}
              onChange={(event) => setField("price_vnd", readNumber(event.target.value))}
            />
          </Field>
          <Field label="Quantity" hint={isEditing ? `${formatNumber(draft.quantity_available)} units` : undefined} error={getFieldError("quantity_available")}>
            <TextInput
              type="number"
              min="0"
              step="1"
              value={draft.quantity_available}
              disabled={!isEditing}
              onChange={(event) => {
                const qty = Math.max(0, Math.floor(readNumber(event.target.value)));
                const status = qty === 0 ? "sold_out" : qty <= 5 ? "limited" : "in_stock";
                const note = qty === 0 ? "Sold out" : qty <= 5 ? "Limited stock" : "In stock";
                setDraft((current) => ({
                  ...current,
                  quantity_available: qty,
                  stock_status: status as StockStatus,
                  stock_note: note,
                }));
              }}
            />
          </Field>
          <Field label="Badge">
            <SelectInput value={draft.badge ?? ""} disabled={!isEditing} onChange={(event) => setField("badge", event.target.value)}>
              <option value="">No badge</option>
              {hasLegacyBadge && <option value={draft.badge}>{draft.badge}</option>}
              {productBadges.map((badge) => (
                <option key={badge} value={badge}>
                  {badge}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <Field label="Description">
          <TextArea value={draft.description} disabled={!isEditing} onChange={(event) => setField("description", event.target.value)} />
        </Field>
        <div className="admin-switch-row">
          <label>
            <input
              type="checkbox"
              checked={draft.featured}
              disabled={!isEditing}
              onChange={(event) => setField("featured", event.target.checked)}
            />
            Featured item
          </label>
          <label>
            <input
              type="checkbox"
              checked={draft.active}
              disabled={!isEditing}
              onChange={(event) => setField("active", event.target.checked)}
            />
            Visible in catalog
          </label>
        </div>
        <div className="image-admin-row">
          {primaryImage ? <img src={primaryImage} alt="" /> : <div className="image-admin-placeholder" aria-hidden="true" />}
          <div>
            {isEditing ? (
              <ImageUpload bucket="product-images" label="Upload Product Image" onUploaded={(url) => setField("images", [url])} />
            ) : (
              <div className="image-admin-note">Image uploads are available while editing.</div>
            )}
            {getFieldError("images") && (
              <div className="field-error-msg" style={{ marginTop: "6px" }}>{getFieldError("images")}</div>
            )}
          </div>
        </div>
        {asyncError && (
          <Alert
            variant="error"
            title="Could not update item"
            onClose={() => {
              setSaveError("");
              setDeleteError("");
            }}
          >
            {asyncError}
          </Alert>
        )}
        <div className="form-actions">
          {isEditing && (
            <Button type="submit" loading={isSaving} loadingText="Saving..." disabled={busy}>
              {isNewProduct ? "Create Item" : "Save Item"}
            </Button>
          )}
          {isEditing && (
            <Button type="button" variant="secondary" icon={isNewProduct ? <RotateCcw size={18} /> : <X size={18} />} disabled={busy} onClick={resetDraft}>
              {isNewProduct ? "Clear" : "Cancel"}
            </Button>
          )}
        </div>
      </form>
    </AdminCard>
  );
}
