import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Edit3, Gift, Package, X } from "lucide-react";
import type { Product, PromotionSettings } from "../../../types/catalog";
import { useAsyncAction } from "../../../hooks/shared/useAsyncAction";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { NumberInput } from "../../ui/NumberInput";
import { Modal } from "../../ui/Modal";
import { AdminCard } from "../shell/AdminCard";
import { AdminEditBar } from "../shell/AdminEditBar";
import { EmptyState } from "../../ui/EmptyState";
import {
  useAdminNavigationGuard,
  useAdminUnsavedChanges,
} from "../shell/AdminUnsavedChanges";
import { AdminFormError } from "../shared/AdminFormError";
import { SelectMenu } from "../../ui/SelectMenu";
import { DateTimeInput } from "../../ui/DateTimeInput";

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromLocalDateTime(value: string) {
  return value ? new Date(value).toISOString() : null;
}

type PromotionSettingsFormProps = {
  promotion: PromotionSettings;
  products: Product[];
  onSave: (promotion: PromotionSettings) => Promise<void>;
};

export function PromotionSettingsForm({
  promotion,
  products,
  onSave,
}: PromotionSettingsFormProps) {
  const [draft, setDraft] = useState(promotion);
  const [isEditing, setIsEditing] = useState(false);
  const { busy, error, run, setError } = useAsyncAction();
  const { t } = usePlatformI18n();
  const requestNavigation = useAdminNavigationGuard();
  const draftRef = useRef(draft);
  const isEditingRef = useRef(isEditing);
  const acceptedPromotionRef = useRef(promotion);

  draftRef.current = draft;
  isEditingRef.current = isEditing;

  useEffect(() => {
    const draftMatchesIncoming =
      JSON.stringify(draftRef.current) === JSON.stringify(promotion);
    if (
      isEditingRef.current &&
      JSON.stringify(draftRef.current) !==
        JSON.stringify(acceptedPromotionRef.current) &&
      !draftMatchesIncoming
    ) {
      return;
    }
    acceptedPromotionRef.current = promotion;
    setDraft(promotion);
    setIsEditing(false);
    setError("");
  }, [promotion, setError]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    let saved = false;
    await run(async () => {
      await onSave({
        ...draft,
        reward_product_ids:
          draft.kind === "percentage" ? [] : draft.reward_product_ids,
      });
      saved = true;
    }).catch(() => undefined);
    if (saved) setIsEditing(false);
  }

  const reset = useCallback(() => {
    setDraft(promotion);
    setIsEditing(false);
    setError("");
  }, [promotion, setError]);

  function toggleProduct(
    group: "qualifying_product_ids" | "reward_product_ids",
    productId: string,
  ) {
    const selected = new Set(draft[group]);
    if (selected.has(productId)) selected.delete(productId);
    else selected.add(productId);
    setDraft({ ...draft, [group]: [...selected] });
  }

  const canEnable =
    draft.qualifying_product_ids.length > 0 &&
    (draft.kind === "percentage" || draft.reward_product_ids.length > 0);
  const scheduleValid =
    !draft.starts_at ||
    !draft.ends_at ||
    new Date(draft.starts_at) < new Date(draft.ends_at);
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(promotion);
  useAdminUnsavedChanges("promotion-settings", isEditing && hasChanges, reset);

  return (
    <>
      <AdminCard
        title={t("Promotion")}
        description={t("Configure one scheduled buy-get or percentage offer.")}
        icon={<Gift size={18} />}
        className="admin-promotion-card"
        density="compact"
        action={
          <Button
            type="button"
            variant="secondary"
            icon={<Edit3 size={17} />}
            onClick={() => setIsEditing(true)}
          >
            {t("Edit")}
          </Button>
        }
      >
        <div className="admin-promotion-form">
          <div className="admin-promotion-summary">
            <div className="admin-promotion-offer">
              <span className="admin-promotion-summary-icon">
                <Gift size={16} />
              </span>
              <span>
                <small>{t("Offer")}</small>
                <strong>
                  {draft.kind === "percentage"
                    ? t("{{percent}}% off selected products", {
                        percent: draft.percentage_off,
                      })
                    : t("Buy {{buy}}, get {{free}} free", {
                        buy: draft.buy_quantity,
                        free: draft.free_quantity,
                      })}
                </strong>
              </span>
            </div>
            <div className="admin-promotion-stat">
              <small>{t("Status")}</small>
              <strong
                className={`admin-promotion-status ${draft.enabled ? "is-active" : "is-inactive"}`}
              >
                {t(draft.enabled ? "Active" : "Inactive")}
              </strong>
            </div>
            <div className="admin-promotion-stat">
              <small>{t("Buy products")}</small>
              <strong>{draft.qualifying_product_ids.length}</strong>
            </div>
            <div className="admin-promotion-stat">
              <small>{t("Type")}</small>
              <strong>
                {t(
                  draft.kind === "percentage"
                    ? "Percentage off"
                    : "Buy X, get Y",
                )}
              </strong>
            </div>
          </div>
          <p className="admin-form-help">
            {t("{{buy}} buy products · {{reward}} reward products", {
              buy: draft.qualifying_product_ids.length,
              reward: draft.reward_product_ids.length,
            })}
          </p>
        </div>
      </AdminCard>

      <Modal
        title={t("Promotion")}
        isOpen={isEditing}
        onClose={() => requestNavigation(reset)}
        wide
        mobileSheet
        appearance="admin"
        dismissible={!busy}
        className="admin-promotion-modal"
        closeLabel={t("Close modal")}
      >
        <form
          className="admin-form admin-promotion-form"
          onSubmit={handleSubmit}
        >
          <AdminFormError
            error={error}
            fallback="Could not save promotion"
            title="Could not save promotion"
            onDismiss={() => setError("")}
          />
          <div className="admin-promotion-editor">
            <div className="admin-promotion-setup-grid">
              <div className="admin-promotion-fields-group">
                <Field label={t("Promotion type")}>
                  <SelectMenu
                    value={draft.kind}
                    disabled={busy}
                    label={t("Promotion type")}
                    options={[
                      { value: "buy_get", label: t("Buy X, get Y") },
                      { value: "percentage", label: t("Percentage off") },
                    ]}
                    onChange={(kind) =>
                      setDraft((current) => ({
                        ...current,
                        kind: kind as PromotionSettings["kind"],
                      }))
                    }
                  />
                </Field>
                {draft.kind === "buy_get" ? (
                  <Field label={t("Customer buys")}>
                    <NumberInput
                      min={1}
                      max={99}
                      value={draft.buy_quantity}
                      disabled={busy}
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          buy_quantity: value,
                        }))
                      }
                    />
                  </Field>
                ) : (
                  <Field label={t("Percentage off")}>
                    <NumberInput
                      min={1}
                      max={100}
                      value={draft.percentage_off}
                      disabled={busy}
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          percentage_off: value,
                        }))
                      }
                    />
                  </Field>
                )}
                {draft.kind === "buy_get" && (
                  <Field label={t("Free quantity")}>
                    <NumberInput
                      min={1}
                      max={99}
                      value={draft.free_quantity}
                      disabled={busy}
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          free_quantity: value,
                        }))
                      }
                    />
                  </Field>
                )}
                {draft.kind === "percentage" && (
                  <Field label={t("Minimum spend (VND)")}>
                    <NumberInput
                      min={0}
                      max={2_000_000_000}
                      value={draft.minimum_subtotal_vnd}
                      disabled={busy}
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          minimum_subtotal_vnd: value,
                        }))
                      }
                    />
                  </Field>
                )}
              </div>

              <div className="admin-promotion-switches-group">
                <label
                  className="compact-switch-label"
                  htmlFor="promotion-enabled"
                >
                  <input
                    id="promotion-enabled"
                    type="checkbox"
                    aria-label={t("Promotion active")}
                    checked={draft.enabled}
                    disabled={busy}
                    onChange={(event) =>
                      setDraft({ ...draft, enabled: event.target.checked })
                    }
                  />
                  <span className="switch-text">
                    <strong>{t("Promotion active")}</strong>
                    <small>
                      {t("Apply this offer in the storefront and checkout.")}
                    </small>
                  </span>
                </label>
                {draft.kind === "buy_get" && (
                  <label
                    className="compact-switch-label"
                    htmlFor="promotion-repeatable"
                  >
                    <input
                      id="promotion-repeatable"
                      type="checkbox"
                      aria-label={t("Repeat offer")}
                      checked={draft.repeatable}
                      disabled={busy}
                      onChange={(event) =>
                        setDraft({ ...draft, repeatable: event.target.checked })
                      }
                    />
                    <span className="switch-text">
                      <strong>{t("Repeat offer")}</strong>
                      <small>
                        {t("Apply the reward again for each complete group.")}
                      </small>
                    </span>
                  </label>
                )}
              </div>
            </div>

            <div className="admin-promotion-setup-grid">
              <Field label={t("Starts (optional)")}>
                <DateTimeInput
                  label={t("Starts (optional)")}
                  value={toLocalDateTime(draft.starts_at)}
                  disabled={busy}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      starts_at: fromLocalDateTime(value),
                    }))
                  }
                />
              </Field>
              <Field
                label={t("Ends (optional)")}
                error={
                  !scheduleValid
                    ? t("End time must be after start time.")
                    : undefined
                }
              >
                <DateTimeInput
                  label={t("Ends (optional)")}
                  value={toLocalDateTime(draft.ends_at)}
                  min={toLocalDateTime(draft.starts_at)}
                  invalid={!scheduleValid}
                  disabled={busy}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      ends_at: fromLocalDateTime(value),
                    }))
                  }
                />
              </Field>
            </div>

            <div className="promotion-rule-preview">
              <span>
                <Gift size={17} />
              </span>
              <strong>
                {draft.kind === "percentage"
                  ? t(
                      "Apply {{percent}}% off to {{count}} selected products after the minimum spend.",
                      {
                        percent: draft.percentage_off,
                        count: draft.qualifying_product_ids.length,
                      },
                    )
                  : t(
                      "Choose {{free}} free items from {{reward}} reward products after buying {{buy}} from {{qualifying}} eligible products.",
                      {
                        buy: draft.buy_quantity,
                        qualifying: draft.qualifying_product_ids.length,
                        free: draft.free_quantity,
                        reward: draft.reward_product_ids.length,
                      },
                    )}
              </strong>
            </div>

            <div
              className={`promotion-products-selection ${draft.kind === "percentage" ? "is-percentage" : ""} ${products.length === 0 ? "is-empty" : ""}`}
            >
              {products.length === 0 ? (
                <EmptyState
                  variant="compact"
                  icon={<Package size={24} />}
                  title={t("No products available")}
                  message={t(
                    "Add products before choosing which items qualify for this promotion.",
                  )}
                />
              ) : (
                <>
                  <div className="promotion-products-header">
                    <span className="col-product-info">{t("Product")}</span>
                    <span className="col-action col-buy-action">
                      <span>{t("Customer buys")}</span>
                      <span className="counter-badge">
                        {draft.qualifying_product_ids.length}/{products.length}
                      </span>
                    </span>
                    {draft.kind === "buy_get" && (
                      <span className="col-action col-free-action">
                        <span>{t("Free item")}</span>
                        <span className="counter-badge">
                          {draft.reward_product_ids.length}/{products.length}
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="promotion-products-list admin-scroll-list">
                    {products.map((product) => {
                      const isBuySelected =
                        draft.qualifying_product_ids.includes(product.id);
                      const isFreeSelected = draft.reward_product_ids.includes(
                        product.id,
                      );
                      const isAnySelected = isBuySelected || isFreeSelected;
                      const image =
                        product.image_variants?.[0]?.thumbnail ??
                        product.images[0];
                      return (
                        <div
                          key={product.id}
                          className={`promotion-product-row ${isAnySelected ? "is-selected" : ""}`}
                        >
                          <div className="promotion-product-info">
                            <span className="promotion-product-thumb">
                              {image ? (
                                <img src={image} alt="" />
                              ) : (
                                <span>{product.name.charAt(0)}</span>
                              )}
                            </span>
                            <span className="promotion-product-copy">
                              <strong>{product.name}</strong>
                              <small>{product.item_code}</small>
                            </span>
                          </div>
                          <div className="promotion-product-actions">
                            <label
                              className="checkbox-wrapper"
                              htmlFor={`promotion-buy-${product.id}`}
                            >
                              <input
                                id={`promotion-buy-${product.id}`}
                                type="checkbox"
                                aria-label={`${product.name} · ${t("Customer buys")}`}
                                checked={isBuySelected}
                                disabled={busy}
                                onChange={() =>
                                  toggleProduct(
                                    "qualifying_product_ids",
                                    product.id,
                                  )
                                }
                              />
                              <span className="checkbox-label-text">
                                {t("Customer buys")}
                              </span>
                            </label>
                            {draft.kind === "buy_get" && (
                              <label
                                className="checkbox-wrapper"
                                htmlFor={`promotion-free-${product.id}`}
                              >
                                <input
                                  id={`promotion-free-${product.id}`}
                                  type="checkbox"
                                  aria-label={`${product.name} · ${t("Free item")}`}
                                  checked={isFreeSelected}
                                  disabled={busy}
                                  onChange={() =>
                                    toggleProduct(
                                      "reward_product_ids",
                                      product.id,
                                    )
                                  }
                                />
                                <span className="checkbox-label-text">
                                  {t("Free item")}
                                </span>
                              </label>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {draft.enabled && !canEnable && (
            <p className="admin-promotion-warning">
              {draft.kind === "percentage"
                ? t(
                    "Select at least one discounted product before publishing this offer.",
                  )
                : t(
                    "Select at least one buy product and one reward product before publishing this offer.",
                  )}
            </p>
          )}

          <AdminEditBar
            status={t(hasChanges ? "Unsaved changes" : "No changes")}
            statusTone={hasChanges ? "dirty" : "saved"}
            modalFooter
          >
            <Button
              type="button"
              variant="secondary"
              icon={<X size={17} />}
              disabled={busy}
              onClick={() => requestNavigation(reset)}
            >
              {t("Cancel")}
            </Button>
            <Button
              type="submit"
              loading={busy}
              loadingText={t("Saving…")}
              disabled={
                !hasChanges || !scheduleValid || (draft.enabled && !canEnable)
              }
            >
              {t("Save promotion")}
            </Button>
          </AdminEditBar>
        </form>
      </Modal>
    </>
  );
}
