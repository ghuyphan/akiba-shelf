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
            <div className="admin-promotion-setup-grid">
              <div className="admin-promotion-fields-group">
                <Field label={t("Customer buys")}>
                  <TextInput type="text" inputMode="numeric" value={draft.buy_quantity} onChange={(event) => setDraft({ ...draft, buy_quantity: boundedQuantity(event.target.value) })} />
                </Field>
                <Field label={t("Customer gets free")}>
                  <TextInput type="text" inputMode="numeric" value={draft.free_quantity} onChange={(event) => setDraft({ ...draft, free_quantity: boundedQuantity(event.target.value) })} />
                </Field>
              </div>

              <div className="admin-promotion-switches-group">
                <label className="compact-switch-label">
                  <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />
                  <span className="switch-text">
                    <strong>{t("Promotion active")}</strong>
                    <small>{t("Apply this offer in the storefront and checkout.")}</small>
                  </span>
                </label>
                <label className="compact-switch-label">
                  <input type="checkbox" checked={draft.repeatable} onChange={(event) => setDraft({ ...draft, repeatable: event.target.checked })} />
                  <span className="switch-text">
                    <strong>{t("Repeat offer")}</strong>
                    <small>{t("Apply the reward again for each complete group.")}</small>
                  </span>
                </label>
              </div>
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

            <div className="promotion-products-selection">
              <div className="promotion-products-header">
                <span className="col-product-info">{t("Product")}</span>
                <span className="col-action col-buy-action">
                  <span>{t("Customer buys")}</span>
                  <span className="counter-badge">{draft.qualifying_product_ids.length}/{products.length}</span>
                </span>
                <span className="col-action col-free-action">
                  <span>{t("Customer gets free")}</span>
                  <span className="counter-badge">{draft.reward_product_ids.length}/{products.length}</span>
                </span>
              </div>
              <div className="promotion-products-list">
                {products.map((product) => {
                  const isBuySelected = draft.qualifying_product_ids.includes(product.id);
                  const isFreeSelected = draft.reward_product_ids.includes(product.id);
                  const isAnySelected = isBuySelected || isFreeSelected;
                  const image = product.image_variants?.[0]?.thumbnail ?? product.images[0];
                  return (
                    <div key={product.id} className={`promotion-product-row ${isAnySelected ? "is-selected" : ""}`}>
                      <div className="promotion-product-info">
                        <span className="promotion-product-thumb">
                          {image ? <img src={image} alt="" /> : <span>{product.name.charAt(0)}</span>}
                        </span>
                        <span className="promotion-product-copy">
                          <strong>{product.name}</strong>
                          <small>{product.item_code}</small>
                        </span>
                      </div>
                      <div className="promotion-product-actions">
                        <label className="checkbox-wrapper">
                          <input
                            type="checkbox"
                            checked={isBuySelected}
                            onChange={() => toggleProduct("qualifying_product_ids", product.id)}
                          />
                          <span className="checkbox-label-text">{t("Customer buys")}</span>
                        </label>
                        <label className="checkbox-wrapper">
                          <input
                            type="checkbox"
                            checked={isFreeSelected}
                            onChange={() => toggleProduct("reward_product_ids", product.id)}
                          />
                          <span className="checkbox-label-text">{t("Customer gets free")}</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
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
