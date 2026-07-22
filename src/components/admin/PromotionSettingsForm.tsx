import { FormEvent, useEffect, useMemo, useState } from "react";
import { Edit3, Gift, Package, X } from "lucide-react";
import type { Product, PromotionSettings } from "../../types/catalog";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { usePlatformI18n } from "../../lib/i18n/platformI18n";
import { useToast } from "../ui/ToastProvider";
import { Button } from "../ui/Button";
import { Field, TextInput } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { AdminCard } from "./AdminCard";
import { AdminEditBar } from "./AdminEditBar";
import { EmptyState } from "../ui/EmptyState";

type PromotionSettingsFormProps = {
  promotion: PromotionSettings;
  products: Product[];
  onSave: (promotion: PromotionSettings) => Promise<void>;
};

function quantityDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 2);
}

function boundedQuantity(value: string) {
  return Math.min(99, Math.max(1, Number(quantityDigits(value)) || 1));
}

export function PromotionSettingsForm({
  promotion,
  products,
  onSave,
}: PromotionSettingsFormProps) {
  const [draft, setDraft] = useState(promotion);
  const [buyQuantityInput, setBuyQuantityInput] = useState(
    String(promotion.buy_quantity),
  );
  const [freeQuantityInput, setFreeQuantityInput] = useState(
    String(promotion.free_quantity),
  );
  const [isEditing, setIsEditing] = useState(false);
  const { busy, error, run, setError } = useAsyncAction();
  const toast = useToast();
  const { t } = usePlatformI18n();

  useEffect(() => {
    setDraft(promotion);
    setBuyQuantityInput(String(promotion.buy_quantity));
    setFreeQuantityInput(String(promotion.free_quantity));
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
      const normalizedDraft = {
        ...draft,
        buy_quantity: boundedQuantity(buyQuantityInput),
        free_quantity: boundedQuantity(freeQuantityInput),
      };

      setDraft(normalizedDraft);
      setBuyQuantityInput(String(normalizedDraft.buy_quantity));
      setFreeQuantityInput(String(normalizedDraft.free_quantity));

      await onSave(normalizedDraft);
      saved = true;
    }).catch(() => undefined);
    if (saved) setIsEditing(false);
  }

  function reset() {
    setDraft(promotion);
    setBuyQuantityInput(String(promotion.buy_quantity));
    setFreeQuantityInput(String(promotion.free_quantity));
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
  const hasChanges = useMemo(() => {
    const normalizedDraft = {
      ...draft,
      buy_quantity: boundedQuantity(buyQuantityInput),
      free_quantity: boundedQuantity(freeQuantityInput),
    };
    return JSON.stringify(normalizedDraft) !== JSON.stringify(promotion);
  }, [buyQuantityInput, draft, freeQuantityInput, promotion]);

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

      <Modal title={t("Quantity promotion")} isOpen={isEditing} onClose={reset} wide mobileSheet appearance="admin" dismissible={!busy} className="admin-promotion-modal" closeLabel={t("Close modal")}>
        <form className="admin-form admin-promotion-form" onSubmit={handleSubmit}>
          <div className="admin-promotion-editor">
            <div className="admin-promotion-setup-grid">
              <div className="admin-promotion-fields-group">
                <Field label={t("Customer buys")}>
                  <TextInput
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={2}
                    value={buyQuantityInput}
                    disabled={busy}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => {
                      const value = quantityDigits(event.target.value);
                      setBuyQuantityInput(value);

                      if (value) {
                        setDraft((current) => ({
                          ...current,
                          buy_quantity: boundedQuantity(value),
                        }));
                      }
                    }}
                    onBlur={() => {
                      const value = boundedQuantity(buyQuantityInput);
                      setBuyQuantityInput(String(value));
                      setDraft((current) => ({
                        ...current,
                        buy_quantity: value,
                      }));
                    }}
                  />
                </Field>
                <Field label={t("Customer gets free")}>
                  <TextInput
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={2}
                    value={freeQuantityInput}
                    disabled={busy}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => {
                      const value = quantityDigits(event.target.value);
                      setFreeQuantityInput(value);

                      if (value) {
                        setDraft((current) => ({
                          ...current,
                          free_quantity: boundedQuantity(value),
                        }));
                      }
                    }}
                    onBlur={() => {
                      const value = boundedQuantity(freeQuantityInput);
                      setFreeQuantityInput(String(value));
                      setDraft((current) => ({
                        ...current,
                        free_quantity: value,
                      }));
                    }}
                  />
                </Field>
              </div>

              <div className="admin-promotion-switches-group">
                <label className="compact-switch-label">
                  <input type="checkbox" checked={draft.enabled} disabled={busy} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />
                  <span className="switch-text">
                    <strong>{t("Promotion active")}</strong>
                    <small>{t("Apply this offer in the storefront and checkout.")}</small>
                  </span>
                </label>
                <label className="compact-switch-label">
                  <input type="checkbox" checked={draft.repeatable} disabled={busy} onChange={(event) => setDraft({ ...draft, repeatable: event.target.checked })} />
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

            <div className={`promotion-products-selection ${products.length === 0 ? "is-empty" : ""}`}>
              {products.length === 0 ? (
                <EmptyState
                  variant="compact"
                  icon={<Package size={24} />}
                  title={t("No products available")}
                  message={t("Add products before choosing which items qualify for this promotion.")}
                />
              ) : (
                <>
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
              <div className="promotion-products-list admin-scroll-list">
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
                            disabled={busy}
                            onChange={() => toggleProduct("qualifying_product_ids", product.id)}
                          />
                          <span className="checkbox-label-text">{t("Customer buys")}</span>
                        </label>
                        <label className="checkbox-wrapper">
                          <input
                            type="checkbox"
                            checked={isFreeSelected}
                            disabled={busy}
                            onChange={() => toggleProduct("reward_product_ids", product.id)}
                          />
                          <span className="checkbox-label-text">{t("Customer gets free")}</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
                </>
              )}
            </div>
          </div>

        {draft.enabled && !canEnable && <p className="admin-promotion-warning">{t("Select at least one buy product and one reward product before publishing this offer.")}</p>}

          <AdminEditBar status={t(hasChanges ? "Unsaved changes" : "No changes")} statusTone={hasChanges ? "dirty" : "saved"}>
            <Button type="button" variant="secondary" icon={<X size={17} />} disabled={busy} onClick={reset}>{t("Cancel")}</Button>
            <Button type="submit" loading={busy} loadingText={t("Saving…")} disabled={!hasChanges || (draft.enabled && !canEnable)}>{t("Save promotion")}</Button>
          </AdminEditBar>
        </form>
      </Modal>
    </>
  );
}
