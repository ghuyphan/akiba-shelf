import { FormEvent, useEffect, useState } from "react";
import type { Product, StockStatus } from "../../types/catalog";
import { normalizeSlug } from "../../lib/format";
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
  const [errors, setErrors] = useState<string[]>([]);
  const { busy: isSaving, error: saveError, run: runSave, setError: setSaveError } = useAsyncAction();
  const { busy: isDeleting, error: deleteError, run: runDelete, setError: setDeleteError } = useAsyncAction();
  const primaryImage = draft.images.find(Boolean);
  const asyncError = saveError || deleteError;
  const busy = isSaving || isDeleting;

  useEffect(() => {
    setDraft(product);
    setErrors([]);
  }, [product]);

  function setField<Key extends keyof Product>(key: Key, value: Product[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validateProduct(draft);
    setErrors(nextErrors);
    if (nextErrors.length > 0) return;

    setDeleteError("");
    await runSave(() => onSave({ ...draft, id: draft.id || normalizeSlug(`${draft.item_code}-${draft.name}`) })).catch(
      () => undefined,
    );
  }

  async function handleDelete() {
    if (!draft.id) return;
    setSaveError("");
    await runDelete(() => onDelete(draft.id)).catch(() => undefined);
  }

  return (
    <AdminCard title="Item Details" description="Keep names short and item codes clear for booth staff.">
      <form className="admin-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <Field label="Name">
            <TextInput value={draft.name} onChange={(event) => setField("name", event.target.value)} />
          </Field>
          <Field label="Item Code">
            <TextInput value={draft.item_code} onChange={(event) => setField("item_code", event.target.value)} />
          </Field>
          <Field label="Collection">
            <TextInput value={draft.collection} onChange={(event) => setField("collection", event.target.value)} />
          </Field>
          <Field label="Category">
            <TextInput value={draft.category} onChange={(event) => setField("category", event.target.value)} />
          </Field>
          <Field label="Price VND">
            <TextInput
              type="number"
              min="0"
              step="1000"
              value={draft.price_vnd}
              onChange={(event) => setField("price_vnd", Number(event.target.value))}
            />
          </Field>
          <Field label="Quantity">
            <TextInput
              type="number"
              min="0"
              step="1"
              value={draft.quantity_available}
              onChange={(event) => setField("quantity_available", Number(event.target.value))}
            />
          </Field>
          <Field label="Badge">
            <TextInput value={draft.badge ?? ""} onChange={(event) => setField("badge", event.target.value)} />
          </Field>
          <Field label="Stock Status">
            <SelectInput
              value={draft.stock_status}
              onChange={(event) => setField("stock_status", event.target.value as StockStatus)}
            >
              <option value="in_stock">In stock</option>
              <option value="limited">Limited</option>
              <option value="sold_out">Sold out</option>
            </SelectInput>
          </Field>
          <Field label="Stock Note">
            <TextInput value={draft.stock_note} onChange={(event) => setField("stock_note", event.target.value)} />
          </Field>
        </div>
        <Field label="Description">
          <TextArea value={draft.description} onChange={(event) => setField("description", event.target.value)} />
        </Field>
        <div className="admin-switch-row">
          <label>
            <input
              type="checkbox"
              checked={draft.featured}
              onChange={(event) => setField("featured", event.target.checked)}
            />
            Featured item
          </label>
          <label>
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(event) => setField("active", event.target.checked)}
            />
            Visible in catalog
          </label>
        </div>
        <div className="image-admin-row">
          {primaryImage ? <img src={primaryImage} alt="" /> : <div className="image-admin-placeholder" aria-hidden="true" />}
          <div>
            <ImageUpload bucket="product-images" label="Upload Product Image" onUploaded={(url) => setField("images", [url])} />
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
        {errors.length > 0 && (
          <div className="form-error">
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        )}
        <div className="form-actions">
          <Button type="submit" loading={isSaving} loadingText="Saving..." disabled={busy}>
            Save Item
          </Button>
          <Button type="button" variant="danger" loading={isDeleting} loadingText="Deleting..." disabled={busy} onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </form>
    </AdminCard>
  );
}
