import { FormEvent, useEffect, useState } from "react";
import type { PaymentSettings } from "../../types/catalog";
import { useAsyncAction } from "../../hooks/useAsyncAction";
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
  const { busy, error, run } = useAsyncAction();
  const banks = getVietQrBanks();
  const selectedBank = getPaymentBank(draft.bank_code, draft.bank_acq_id);

  useEffect(() => setDraft(settings), [settings]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await run(() => onSave(draft)).catch(() => undefined);
  }

  return (
    <AdminCard title="Payment QR" description="Generate bank QR by item amount, with static QR fallback.">
      <form className="admin-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <Field label="Payment Label">
            <TextInput value={draft.bank_label} onChange={(event) => setDraft({ ...draft, bank_label: event.target.value })} />
          </Field>
          <Field label="Bank">
            <SelectInput
              value={selectedBank?.code ?? ""}
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
            <img src={getBankLogoUrl(selectedBank)} alt="" />
            <span>
              <strong>{selectedBank?.name ?? "No bank selected"}</strong>
              <small>{selectedBank?.full_name ?? "Choose a bank to generate dynamic VietQR codes"}</small>
            </span>
          </div>
          <Field label="Account Number">
            <TextInput
              value={draft.bank_account_no ?? ""}
              onChange={(event) => setDraft({ ...draft, bank_account_no: event.target.value })}
            />
          </Field>
          <Field label="Account Name">
            <TextInput
              value={draft.bank_account_name ?? ""}
              onChange={(event) => setDraft({ ...draft, bank_account_name: event.target.value })}
            />
          </Field>
        </div>
        <Field label="Transfer Message Template" hint="Available tokens: {code}, {item}, {amount}">
          <TextInput
            value={draft.bank_add_info_template ?? ""}
            onChange={(event) => setDraft({ ...draft, bank_add_info_template: event.target.value })}
          />
        </Field>
        <details className="advanced-payment-settings">
          <summary>Fallback QR</summary>
          <div className="fallback-qr-row">
            <Field label="Fallback QR URL">
              <TextInput value={draft.bank_qr_url} onChange={(event) => setDraft({ ...draft, bank_qr_url: event.target.value })} />
            </Field>
            <ImageUpload bucket="payment-qr" label="Upload QR" onUploaded={(url) => setDraft({ ...draft, bank_qr_url: url })} />
          </div>
        </details>
        <Field label="Payment Instructions">
          <TextArea
            value={draft.payment_instructions}
            onChange={(event) => setDraft({ ...draft, payment_instructions: event.target.value })}
          />
        </Field>
        {error && <p className="form-error">{error}</p>}
        <Button type="submit" disabled={busy}>
          Save QR Settings
        </Button>
      </form>
    </AdminCard>
  );
}
