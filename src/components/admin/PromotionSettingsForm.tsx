import { FormEvent, useEffect, useState } from "react";
import { Edit3, Gift, X } from "lucide-react";
import type { Product, PromotionSettings } from "../../types/catalog";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { usePlatformI18n } from "../../lib/platformI18n";
import { useToast } from "../ui/ToastProvider";
import { Button } from "../ui/Button";
import { Field, TextInput } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { AdminCard } from "./AdminCard";

type PromotionSettingsFormProps = {
  promotion: PromotionSettings;
  products: Product[];
  onSave: (promotion: PromotionSettings) => Promise<void>;
};

function boundedQuantity(value: string) {
  return Math.min(99, Math.max(1, Number(value.replace(/\D/g, "")) || 1));
}

export function PromotionSettingsForm({
  promotion,
  products,
  onSave,
}: PromotionSettingsFormProps) {
  const [draft, setDraft] = useState(promotion);
  const [isEditing, setIsEditing] = useState(false);
  const { busy, error, run, setError } = useAsyncAction();
  const toast = useToast();
  const { t } = usePlatformI18n();

  useEffect(() => {
    setDraft(promotion);
    setIsEditing(false);
    setError("");
  }, [promotion, setError]);

  useEffect(() => {
    if (!error) return;
    toast.error(t(error), t("Could not save promotion"));
    setError("");
  }, [error, setError, t, toast]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    let saved = false;
    await run(async () => {
      await onSave(draft);
      saved = true;
    }).catch(() => undefined);
    if (saved) setIsEditing(false);
  }

  function reset() {
    setDraft(promotion);
    setIsEditing(false);
    setError("");
  }

  function toggleProduct(group: "qualifying_product_ids" | "reward_product_ids", productId: string) {
    const selected = new Set(draft[group]);
    if (selected.has(productId)) selected.delete(productId);
    else selected.add(productId);
    setDraft({ ...draft, [group]: [...selected] });
  }

  const canEnable = draft.qualifying_product_ids.length > 0 && draft.reward_product_ids.length > 0;

  return (
    <>
      <AdminCard
        title={t("Quantity promotion")}
        description={t("Configure a mix-and-match buy-X-get-Y offer.")}
        icon={<Gift size={18} />}
        className="admin-promotion-card"
        action={(
        <Button type="button" variant="secondary" icon={<Edit3 size={17} />} onClick={() => setIsEditing(true)}>
          {t("Edit")}
        </Button>
        )}
      >
        <div className="admin-promotion-form">
          <div className="admin-promotion-summary">
            <div className="admin-promotion-offer">
              <span className="admin-promotion-summary-icon"><Gift size={16} /></span>
              <span><small>{t("Offer")}</small><strong>{t("Buy {{buy}}, get {{free}} free", { buy: draft.buy_quantity, free: draft.free_quantity })}</strong></span>
            </div>
            <div className="admin-promotion-stat">
              <small>{t("Status")}</small>
              <strong className={`admin-promotion-status ${draft.enabled ? "is-active" : "is-inactive"}`}>{t(draft.enabled ? "Active" : "Inactive")}</strong>
            </div>
            <div className="admin-promotion-stat">
              <small>{t("Buy products")}</small>
              <strong>{draft.qualifying_product_ids.length}</strong>
            </div>
            <div className="admin-promotion-stat">
              <small>{t("Repeat offer")}</small>
              <strong>{t(draft.repeatable ? "Active" : "Inactive")}</strong>
            </div>
          </div>
          <p className="admin-form-help">{t("{{buy}} buy products · {{reward}} reward products", { buy: draft.qualifying_product_ids.length, reward: draft.reward_product_ids.length })}</p>
        </div>
      </AdminCard>

      <Modal title={t("Quantity promotion")} isOpen={isEditing} onClose={reset} wide mobileSheet className="admin-promotion-modal">
        <form className="admin-form admin-promotion-form" onSubmit={handleSubmit}>
          <div className="admin-promotion-editor">
            <div className="admin-promotion-quantities">
              <Field label={t("Customer buys")} hint={t("Paid items required in each offer group.")}>
                <TextInput type="text" inputMode="numeric" value={draft.buy_quantity} onChange={(event) => setDraft({ ...draft, buy_quantity: boundedQuantity(event.target.value) })} />
              </Field>
              <Field label={t("Customer gets free")} hint={t("Customers choose free items from the selected reward products.")}>
                <TextInput type="text" inputMode="numeric" value={draft.free_quantity} onChange={(event) => setDraft({ ...draft, free_quantity: boundedQuantity(event.target.value) })} />
              </Field>
            </div>

            <div className="admin-switch-row">
              <label><span><strong>{t("Promotion active")}</strong><small>{t("Apply this offer in the storefront and checkout.")}</small></span><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} /></label>
              <label><span><strong>{t("Repeat offer")}</strong><small>{t("Apply the reward again for each complete group.")}</small></span><input type="checkbox" checked={draft.repeatable} onChange={(event) => setDraft({ ...draft, repeatable: event.target.checked })} /></label>
            </div>

            <div className="promotion-rule-preview">
              <span><Gift size={17} /></span>
              <strong>{t("Buy any {{buy}} from {{qualifying}} selected products, then choose {{free}} free from {{reward}} reward products.", {
                buy: draft.buy_quantity,
                qualifying: draft.qualifying_product_ids.length,
                free: draft.free_quantity,
                reward: draft.reward_product_ids.length,
              })}</strong>
            </div>

            <div className="promotion-product-groups">
              <section>
                <header className="promotion-product-group-header">
                  <div>
                    <strong>{t("Products that count toward Buy {{buy}}", { buy: draft.buy_quantity })}</strong>
                    <small>{t("These paid products count toward the Buy quantity.")}</small>
                  </div>
                  <span>{draft.qualifying_product_ids.length}/{products.length}</span>
                </header>
                <div className="promotion-product-list">
                  {products.map((product) => {
                    const selected = draft.qualifying_product_ids.includes(product.id);
                    const image = product.image_variants?.[0]?.thumbnail ?? product.images[0];
                    return (
                      <label key={`buy-${product.id}`} className={selected ? "is-selected" : ""}>
                        <span className="promotion-product-thumb">
                          {image ? <img src={image} alt="" /> : <span>{product.name.charAt(0)}</span>}
                        </span>
                        <span className="promotion-product-copy">
                          <strong>{product.name}</strong>
                          <small>{product.item_code}</small>
                        </span>
                        <input type="checkbox" checked={selected} onChange={() => toggleProduct("qualifying_product_ids", product.id)} />
                      </label>
                    );
                  })}
                </div>
              </section>
              <section>
                <header className="promotion-product-group-header">
                  <div>
                    <strong>{t("Products customers can choose free")}</strong>
                    <small>{t("Customers choose free items from this reward group.")}</small>
                  </div>
                  <span>{draft.reward_product_ids.length}/{products.length}</span>
                </header>
                <div className="promotion-product-list">
                  {products.map((product) => {
                    const selected = draft.reward_product_ids.includes(product.id);
                    const image = product.image_variants?.[0]?.thumbnail ?? product.images[0];
                    return (
                      <label key={`reward-${product.id}`} className={selected ? "is-selected" : ""}>
                        <span className="promotion-product-thumb">
                          {image ? <img src={image} alt="" /> : <span>{product.name.charAt(0)}</span>}
                        </span>
                        <span className="promotion-product-copy">
                          <strong>{product.name}</strong>
                          <small>{product.item_code}</small>
                        </span>
                        <input type="checkbox" checked={selected} onChange={() => toggleProduct("reward_product_ids", product.id)} />
                      </label>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>

        {draft.enabled && !canEnable && <p className="admin-promotion-warning">{t("Select at least one buy product and one reward product before publishing this offer.")}</p>}

          <div className="admin-sticky-actions">
            <Button type="submit" loading={busy} loadingText={t("Saving…")} disabled={draft.enabled && !canEnable}>{t("Save promotion")}</Button>
            <Button type="button" variant="secondary" icon={<X size={17} />} disabled={busy} onClick={reset}>{t("Cancel")}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
