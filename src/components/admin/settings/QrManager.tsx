import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BadgeDollarSign,
  Building2,
  Check,
  Copy,
  CreditCard,
  Edit3,
  MessageSquareText,
  QrCode,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import type { PaymentSettings } from "../../../types/catalog";
import { useAsyncAction } from "../../../hooks/shared/useAsyncAction";
import { Button } from "../../ui/Button";
import { Field, TextArea, TextInput } from "../../ui/Field";
import { SelectMenu } from "../../ui/SelectMenu";
import { AdminCard } from "../shell/AdminCard";
import { AdminEditBar } from "../shell/AdminEditBar";
import { ImageUpload } from "../shared/ImageUpload";
import {
  getBankLogoUrl,
  getPaymentBank,
  getVietQrBanks,
} from "../../../utils/banks";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";
import { useAdminUnsavedChanges } from "../shell/AdminUnsavedChanges";
import { AdminFormError } from "../shared/AdminFormError";

type QrManagerProps = {
  shopId: string;
  shopSlug?: string;
  settings: PaymentSettings;
  onSave: (settings: PaymentSettings) => Promise<void>;
};

export function QrManager({ shopId, shopSlug, settings, onSave }: QrManagerProps) {
  const [draft, setDraft] = useState(settings);
  const [isEditing, setIsEditing] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const activeShopIdRef = useRef(shopId);
  const acceptedSettingsRef = useRef(settings);
  const draftRef = useRef(draft);
  const { busy, error, run, setError } = useAsyncAction();
  const { t } = usePlatformI18n();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || (typeof window !== "undefined" ? window.location.origin : "");
  const webhookUrl = `${supabaseUrl}/functions/v1/payment-webhook?shop=${shopSlug || shopId}`;

  const copyWebhookUrl = async () => {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    } catch {
      // ignore
    }
  };

  const generateRandomSecret = () => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    setDraft((current) => ({
      ...current,
      webhook_secret: `whsec_${hex}`,
    }));
  };

  const hasChanges = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(settings),
    [draft, settings],
  );
  const isEditingRef = useRef(isEditing);

  isEditingRef.current = isEditing;
  draftRef.current = draft;

  const banks = getVietQrBanks();
  const selectedBank = getPaymentBank(draft.bank_code, draft.bank_acq_id);
  useEffect(() => {
    const sameShop = activeShopIdRef.current === shopId;
    const hasDirtyDraft =
      JSON.stringify(draftRef.current) !==
      JSON.stringify(acceptedSettingsRef.current);
    const draftMatchesIncoming =
      JSON.stringify(draftRef.current) === JSON.stringify(settings);
    activeShopIdRef.current = shopId;
    if (
      sameShop &&
      isEditingRef.current &&
      hasDirtyDraft &&
      !draftMatchesIncoming
    ) {
      return;
    }
    acceptedSettingsRef.current = settings;
    setDraft(settings);
    setIsEditing(false);
    setError("");
  }, [settings, shopId, setError]);
  const resetDraft = useCallback(() => {
    setDraft(settings);
    setIsEditing(false);
    setError("");
  }, [settings, setError]);
  useAdminUnsavedChanges(
    `payment:${shopId}`,
    isEditing && hasChanges,
    resetDraft,
  );
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    let saved = false;
    await run(async () => {
      await onSave(draft);
      saved = true;
    }).catch(() => undefined);
    if (saved) setIsEditing(false);
  }

  return (
    <AdminCard
      title={t("Payment & QR")}
      description={t("Bank details and payment instructions.")}
      icon={<QrCode size={18} />}
      dataGuideSpotlight="payment-settings"
      action={
        !isEditing ? (
          <Button
            type="button"
            variant="secondary"
            icon={<Edit3 size={17} />}
            onClick={() => setIsEditing(true)}
          >
            {t("Edit")}
          </Button>
        ) : undefined
      }
    >
      <form className="admin-form" onSubmit={handleSubmit}>
        <AdminFormError
          error={error}
          fallback="Could not save payment settings"
          title="Could not save payment settings"
          onDismiss={() => setError("")}
        />
        {!isEditing && (
          <div className="admin-readout">
            <span>
              <Building2 size={16} />
              <small>{t("Bank")}</small>
              <strong>{selectedBank?.name ?? t("Not set")}</strong>
            </span>
            <span>
              <CreditCard size={16} />
              <small>{t("Account")}</small>
              <strong>{draft.bank_account_no || t("Not set")}</strong>
            </span>
            <span>
              <BadgeDollarSign size={16} />
              <small>{t("Label")}</small>
              <strong>{draft.bank_label || t("Payment")}</strong>
            </span>
            <span>
              <Sparkles size={16} />
              <small>{t("Auto-confirm")}</small>
              <strong>{draft.auto_confirm_enabled ? t("Enabled") : t("Off")}</strong>
            </span>
          </div>
        )}

        <section className="admin-form-section">
          <div className="admin-form-section-heading">
            <span>
              <Building2 size={15} />
            </span>
            <div>
              <h3>{t("Bank account")}</h3>
              <p>{t("Used to generate each payment QR.")}</p>
            </div>
          </div>
          <div className="admin-bank-card">
            <img
              src={getBankLogoUrl(selectedBank)}
              alt=""
              onError={(event) => {
                event.currentTarget.src = getBankLogoUrl();
              }}
            />
            <div>
              <strong>{selectedBank?.name ?? t("Choose a bank")}</strong>
              <small>
                {selectedBank?.full_name ?? t("No bank is configured yet")}
              </small>
            </div>
            <span>{draft.bank_account_no || t("Account not set")}</span>
          </div>
          <div className="form-grid">
            <Field label={t("Payment display name")}>
              <TextInput
                value={draft.bank_label}
                disabled={!isEditing}
                onChange={(event) =>
                  setDraft({ ...draft, bank_label: event.target.value })
                }
              />
            </Field>
            <Field label={t("Bank")}>
              <SelectMenu
                label={t("Bank")}
                value={selectedBank?.code ?? ""}
                disabled={!isEditing}
                options={[
                  { value: "", label: t("Select bank") },
                  ...banks.map((bank) => ({
                    value: bank.code,
                    label: bank.name,
                    description: bank.full_name,
                  })),
                ]}
                onChange={(value) => {
                  const bank = banks.find((item) => item.code === value);
                  setDraft({
                    ...draft,
                    bank_code: bank?.code ?? "",
                    bank_acq_id: bank?.bin ?? "",
                  });
                }}
              />
            </Field>
            <Field label={t("Account number")}>
              <TextInput
                value={draft.bank_account_no ?? ""}
                disabled={!isEditing}
                onChange={(event) =>
                  setDraft({ ...draft, bank_account_no: event.target.value })
                }
              />
            </Field>
            <Field label={t("Account name")}>
              <TextInput
                value={draft.bank_account_name ?? ""}
                disabled={!isEditing}
                onChange={(event) =>
                  setDraft({ ...draft, bank_account_name: event.target.value })
                }
              />
            </Field>
          </div>
        </section>

        <section className="admin-form-section">
          <div className="admin-form-section-heading">
            <span>
              <MessageSquareText size={15} />
            </span>
            <div>
              <h3>{t("Transfer message")}</h3>
              <p>{t("Match payments to orders with tokens.")}</p>
            </div>
          </div>
          <Field
            label={t("Transfer message template")}
            hint={t("Available tokens: {code}, {item}, {amount}")}
          >
            <TextInput
              value={draft.bank_add_info_template ?? ""}
              disabled={!isEditing}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  bank_add_info_template: event.target.value,
                })
              }
            />
          </Field>
          <Field label={t("Customer payment instructions")}>
            <TextArea
              value={draft.payment_instructions}
              disabled={!isEditing}
              onChange={(event) =>
                setDraft({ ...draft, payment_instructions: event.target.value })
              }
            />
          </Field>
        </section>

        <section className="admin-form-section">
          <div className="admin-form-section-heading">
            <span>
              <Sparkles size={15} />
            </span>
            <div>
              <h3>{t("Automated payment verification")}</h3>
              <p>{t("Auto-confirm orders via payOS, SePay, or Android notification webhook.")}</p>
            </div>
          </div>
          <div className="form-grid">
            <Field label={t("Auto-confirm payments")}>
              <label
                className="admin-checkbox-label"
                htmlFor="qr-manager-payment-auto-confirm"
              >
                <input
                  id="qr-manager-payment-auto-confirm"
                  type="checkbox"
                  aria-label={t("Enable automated confirmation")}
                  checked={draft.auto_confirm_enabled ?? false}
                  disabled={!isEditing}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      auto_confirm_enabled: event.target.checked,
                    })
                  }
                />
                <span>{t("Enable automated confirmation")}</span>
              </label>
            </Field>
            {draft.auto_confirm_enabled && (
              <>
                <Field
                  label={t("Webhook URL")}
                  hint={t("Paste this URL into your payOS or webhook forwarder settings.")}
                >
                  <div className="admin-copyable-field">
                    <TextInput
                      value={webhookUrl}
                      readOnly
                      disabled
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      icon={copiedWebhook ? <Check size={16} /> : <Copy size={16} />}
                      onClick={() => void copyWebhookUrl()}
                    >
                      {copiedWebhook ? t("Copied") : t("Copy")}
                    </Button>
                  </div>
                </Field>
                <Field
                  label={t("Webhook Secret (for MacroDroid / SePay / Custom)")}
                  hint={t("Secret sent in x-webhook-secret header.")}
                >
                  <div className="admin-copyable-field">
                    <TextInput
                      value={draft.webhook_secret ?? ""}
                      disabled={!isEditing}
                      placeholder="whsec_..."
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          webhook_secret: event.target.value,
                        })
                      }
                    />
                    {isEditing && (
                      <Button
                        type="button"
                        variant="secondary"
                        icon={<RefreshCw size={16} />}
                        onClick={generateRandomSecret}
                      >
                        {t("Generate")}
                      </Button>
                    )}
                  </div>
                </Field>
                <Field
                  label={t("payOS Checksum Key (for payOS HMAC-SHA256)")}
                  hint={t("Found in payOS Dashboard > Integration.")}
                >
                  <TextInput
                    value={draft.payos_checksum_key ?? ""}
                    disabled={!isEditing}
                    placeholder={t("Paste Checksum Key from payOS")}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        payos_checksum_key: event.target.value,
                      })
                    }
                  />
                </Field>
                <Field label={t("payOS Client ID")}>
                  <TextInput
                    value={draft.payos_client_id ?? ""}
                    disabled={!isEditing}
                    placeholder={t("Optional Client ID")}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        payos_client_id: event.target.value,
                      })
                    }
                  />
                </Field>
                <Field label={t("payOS API Key")}>
                  <TextInput
                    value={draft.payos_api_key ?? ""}
                    disabled={!isEditing}
                    placeholder={t("Optional API Key")}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        payos_api_key: event.target.value,
                      })
                    }
                  />
                </Field>
                <div className="admin-webhook-guide">
                  <strong>{t("How to set up automated alerts (100% Free):")}</strong>
                  <p><strong>{t("Option 1: payOS (Recommended)")}</strong></p>
                  <ol>
                    <li>{t("1. Sign up at payos.vn and link your bank account.")}</li>
                    <li>{t("2. Paste the Webhook URL above into payOS Webhook Settings.")}</li>
                    <li>{t("3. Copy the Checksum Key from payOS into the field below.")}</li>
                  </ol>
                  <p style={{ marginTop: 8 }}><strong>{t("Option 2: Android Phone Forwarder (MacroDroid / Tasker)")}</strong></p>
                  <ol>
                    <li>{t("1. Install MacroDroid on your Android phone with banking notifications enabled.")}</li>
                    <li>{t("2. Create a macro to HTTP POST bank push notifications to the Webhook URL.")}</li>
                    <li>{t("3. Add header x-webhook-secret matching the secret key below.")}</li>
                  </ol>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="admin-form-section">
          <div className="admin-form-section-heading">
            <span>
              <QrCode size={15} />
            </span>
            <div>
              <h3>{t("Backup QR")}</h3>
              <p>{t("Used if VietQR is unavailable.")}</p>
            </div>
          </div>
          <div className="admin-fallback-qr">
            <div>
              {draft.bank_qr_url ? (
                <img src={draft.bank_qr_url} alt={t("Fallback payment QR")} />
              ) : (
                <QrCode size={32} />
              )}
            </div>
            <div>
              <Field label={t("Fallback QR URL")}>
                <TextInput
                  value={draft.bank_qr_url}
                  disabled={!isEditing}
                  onChange={(event) =>
                    setDraft({ ...draft, bank_qr_url: event.target.value })
                  }
                />
              </Field>
              {isEditing && (
                <ImageUpload
                  shopId={shopId}
                  bucket="payment-qr"
                  label={t("Upload fallback QR")}
                  onUploaded={(url) =>
                    setDraft((current) => ({
                      ...current,
                      bank_qr_url: url,
                    }))
                  }
                />
              )}
            </div>
          </div>
        </section>

        {isEditing && (
          <AdminEditBar
            status={t(hasChanges ? "Unsaved changes" : "No changes")}
            statusTone={hasChanges ? "dirty" : "saved"}
          >
            <Button
              type="button"
              variant="secondary"
              icon={<X size={17} />}
              disabled={busy}
              onClick={resetDraft}
            >
              {t("Cancel")}
            </Button>
            <Button
              type="submit"
              loading={busy}
              loadingText={t("Saving…")}
              disabled={!hasChanges}
            >
              {t("Save payment settings")}
            </Button>
          </AdminEditBar>
        )}
      </form>
    </AdminCard>
  );
}
