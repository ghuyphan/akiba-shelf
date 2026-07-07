import { FormEvent, useEffect, useState } from "react";
import { BadgeDollarSign, Building2, CreditCard, Edit3, QrCode, X } from "lucide-react";
import type { PaymentSettings } from "../../types/catalog";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Field, SelectInput, TextArea, TextInput } from "../ui/Field";
import { AdminCard } from "./AdminCard";
import { ImageUpload } from "./ImageUpload";
import { getBankLogoUrl, getPaymentBank, getVietQrBanks } from "../../lib/banks";

type QrManagerProps = {
  settings: PaymentSettings;
  onSave: (settings: PaymentSettings) => Promise<void>;
};

export function QrManager({ settings, onSave }: QrManagerProps) {
  const [draft, setDraft] = useState(settings);
  const [isEditing, setIsEditing] = useState(false);
  const { busy, error, run, setError } = useAsyncAction();
  const banks = getVietQrBanks();
  const selectedBank = getPaymentBank(draft.bank_code, draft.bank_acq_id);

  useEffect(() => {
    setDraft(settings);
    setIsEditing(false);
    setError("");
  }, [settings]);

  function resetDraft() {
    setDraft(settings);
    setIsEditing(false);
    setError("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    let didSave = false;
    await run(async () => {
      await onSave(draft);
      didSave = true;
    }).catch(() => undefined);
    if (didSave) setIsEditing(false);
  }

  return (
    <AdminCard
      title="Payment QR"
      description="Review payment details here. Edit only when the booth payment account changes."
      icon={<QrCode size={18} />}
      action={
        !isEditing ? (
          <Button type="button" variant="secondary" icon={<Edit3 size={18} />} onClick={() => setIsEditing(true)}>
            Edit
          </Button>
        ) : undefined
      }
    >
      <form className="admin-form" onSubmit={handleSubmit}>
        {!isEditing && (
          <div className="admin-readout" aria-label="Payment summary">
            <span>
              <Building2 size={16} />
              <small>Bank</small>
              <strong>{selectedBank?.name ?? "Not set"}</strong>
            </span>
            <span>
              <CreditCard size={16} />
              <small>Account</small>
              <strong>{draft.bank_account_no || "Not set"}</strong>
            </span>
            <span>
              <BadgeDollarSign size={16} />
              <small>Label</small>
              <strong>{draft.bank_label || "Payment"}</strong>
            </span>
          </div>
        )}
        <div className="form-grid">
          <Field label="Payment Label">
            <TextInput
              value={draft.bank_label}
              disabled={!isEditing}
              onChange={(event) => setDraft({ ...draft, bank_label: event.target.value })}
            />
          </Field>
          <Field label="Bank">
            <SelectInput
              value={selectedBank?.code ?? ""}
              disabled={!isEditing}
              onChange={(event) => {
                const bank = banks.find((item) => item.code === event.target.value);
                setDraft({
                  ...draft,
                  bank_code: bank?.code ?? "",
                  bank_acq_id: bank?.bin ?? "",
                });
              }}
            >
              <option value="">Select bank</option>
              {banks.map((bank) => (
                <option key={bank.code} value={bank.code}>
                  {bank.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <div className={`selected-bank-summary ${selectedBank ? "" : "selected-bank-summary-empty"}`}>
            <img
              src={getBankLogoUrl(selectedBank)}
              alt=""
              onError={(event) => {
                event.currentTarget.src = getBankLogoUrl();
              }}
            />
            <span>
              <strong>{selectedBank?.name ?? "No bank selected"}</strong>
              <small>{selectedBank?.full_name ?? "Choose a bank to generate dynamic VietQR codes"}</small>
            </span>
          </div>
          <Field label="Account Number">
            <TextInput
              value={draft.bank_account_no ?? ""}
              disabled={!isEditing}
              onChange={(event) => setDraft({ ...draft, bank_account_no: event.target.value })}
            />
          </Field>
          <Field label="Account Name">
            <TextInput
              value={draft.bank_account_name ?? ""}
              disabled={!isEditing}
              onChange={(event) => setDraft({ ...draft, bank_account_name: event.target.value })}
            />
          </Field>
        </div>
        <Field label="Transfer Message Template" hint="Available tokens: {code}, {item}, {amount}">
          <TextInput
            value={draft.bank_add_info_template ?? ""}
            disabled={!isEditing}
            onChange={(event) => setDraft({ ...draft, bank_add_info_template: event.target.value })}
          />
        </Field>
        <details className="advanced-payment-settings" open={isEditing ? undefined : false}>
          <summary>Fallback QR</summary>
          <div className="fallback-qr-row">
            <Field label="Fallback QR URL">
              <TextInput
                value={draft.bank_qr_url}
                disabled={!isEditing}
                onChange={(event) => setDraft({ ...draft, bank_qr_url: event.target.value })}
              />
            </Field>
            {isEditing ? (
              <ImageUpload bucket="payment-qr" label="Upload QR" onUploaded={(url) => setDraft({ ...draft, bank_qr_url: url })} />
            ) : (
              <div className="image-admin-note">Fallback upload is available while editing.</div>
            )}
          </div>
        </details>
        <Field label="Payment Instructions">
          <TextArea
            value={draft.payment_instructions}
            disabled={!isEditing}
            onChange={(event) => setDraft({ ...draft, payment_instructions: event.target.value })}
          />
        </Field>
        {error && (
          <Alert variant="error" title="Could not save QR settings" onClose={() => setError("")}>
            {error}
          </Alert>
        )}
        {isEditing && (
          <div className="form-actions">
            <Button type="submit" loading={busy} loadingText="Saving...">
              Save QR Settings
            </Button>
            <Button type="button" variant="secondary" icon={<X size={18} />} disabled={busy} onClick={resetDraft}>
              Cancel
            </Button>
          </div>
        )}
      </form>
    </AdminCard>
  );
}
