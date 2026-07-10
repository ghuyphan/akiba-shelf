import { FormEvent, useEffect, useState } from "react";
import { BadgeDollarSign, Building2, CreditCard, Edit3, MessageSquareText, QrCode, X } from "lucide-react";
import type { PaymentSettings } from "../../types/catalog";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Field, SelectInput, TextArea, TextInput } from "../ui/Field";
import { AdminCard } from "./AdminCard";
import { ImageUpload } from "./ImageUpload";
import { getBankLogoUrl, getPaymentBank, getVietQrBanks } from "../../lib/banks";

type QrManagerProps = { settings: PaymentSettings; onSave: (settings: PaymentSettings) => Promise<void> };

export function QrManager({ settings, onSave }: QrManagerProps) {
  const [draft, setDraft] = useState(settings);
  const [isEditing, setIsEditing] = useState(false);
  const { busy, error, run, setError } = useAsyncAction();
  const banks = getVietQrBanks();
  const selectedBank = getPaymentBank(draft.bank_code, draft.bank_acq_id);
  useEffect(() => { setDraft(settings); setIsEditing(false); setError(""); }, [settings]);
  function resetDraft() { setDraft(settings); setIsEditing(false); setError(""); }
  async function handleSubmit(event: FormEvent) { event.preventDefault(); let saved = false; await run(async () => { await onSave(draft); saved = true; }).catch(() => undefined); if (saved) setIsEditing(false); }

  return (
    <AdminCard title="Payment & QR" description="Bank account, generated VietQR content, and customer instructions." icon={<QrCode size={18} />} action={!isEditing ? <Button type="button" variant="secondary" icon={<Edit3 size={17} />} onClick={() => setIsEditing(true)}>Edit settings</Button> : undefined}>
      <form className="admin-form" onSubmit={handleSubmit}>
        {!isEditing && <div className="admin-readout"><span><Building2 size={16} /><small>Bank</small><strong>{selectedBank?.name ?? "Not set"}</strong></span><span><CreditCard size={16} /><small>Account</small><strong>{draft.bank_account_no || "Not set"}</strong></span><span><BadgeDollarSign size={16} /><small>Label</small><strong>{draft.bank_label || "Payment"}</strong></span></div>}

        <section className="admin-form-section">
          <div className="admin-form-section-heading"><span>01</span><div><h3>Receiving account</h3><p>The destination encoded into every generated payment QR.</p></div></div>
          <div className="admin-bank-card"><img src={getBankLogoUrl(selectedBank)} alt="" onError={(event) => { event.currentTarget.src = getBankLogoUrl(); }} /><div><strong>{selectedBank?.name ?? "Choose a bank"}</strong><small>{selectedBank?.full_name ?? "No bank is configured yet"}</small></div><span>{draft.bank_account_no || "Account not set"}</span></div>
          <div className="form-grid"><Field label="Payment label"><TextInput value={draft.bank_label} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, bank_label: event.target.value })} /></Field><Field label="Bank"><SelectInput value={selectedBank?.code ?? ""} disabled={!isEditing} onChange={(event) => { const bank = banks.find((item) => item.code === event.target.value); setDraft({ ...draft, bank_code: bank?.code ?? "", bank_acq_id: bank?.bin ?? "" }); }}><option value="">Select bank</option>{banks.map((bank) => <option key={bank.code} value={bank.code}>{bank.name}</option>)}</SelectInput></Field><Field label="Account number"><TextInput value={draft.bank_account_no ?? ""} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, bank_account_no: event.target.value })} /></Field><Field label="Account name"><TextInput value={draft.bank_account_name ?? ""} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, bank_account_name: event.target.value })} /></Field></div>
        </section>

        <section className="admin-form-section">
          <div className="admin-form-section-heading"><span><MessageSquareText size={15} /></span><div><h3>Transfer content</h3><p>Use tokens to keep each payment matched to the right order.</p></div></div>
          <Field label="Transfer message template" hint="Available tokens: {code}, {item}, {amount}"><TextInput value={draft.bank_add_info_template ?? ""} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, bank_add_info_template: event.target.value })} /></Field>
          <Field label="Customer payment instructions"><TextArea value={draft.payment_instructions} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, payment_instructions: event.target.value })} /></Field>
        </section>

        <section className="admin-form-section">
          <div className="admin-form-section-heading"><span><QrCode size={15} /></span><div><h3>Fallback QR</h3><p>Shown only if a dynamic VietQR image cannot be generated.</p></div></div>
          <div className="admin-fallback-qr"><div>{draft.bank_qr_url ? <img src={draft.bank_qr_url} alt="Fallback payment QR" /> : <QrCode size={32} />}</div><div><Field label="Fallback QR URL"><TextInput value={draft.bank_qr_url} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, bank_qr_url: event.target.value })} /></Field>{isEditing && <ImageUpload bucket="payment-qr" label="Upload fallback QR" onUploaded={(url) => setDraft({ ...draft, bank_qr_url: url })} />}</div></div>
        </section>

        {error && <Alert variant="error" title="Could not save payment settings" onClose={() => setError("")}>{error}</Alert>}
        {isEditing && <div className="admin-sticky-actions"><Button type="submit" loading={busy} loadingText="Saving…">Save payment settings</Button><Button type="button" variant="secondary" icon={<X size={17} />} disabled={busy} onClick={resetDraft}>Cancel</Button></div>}
      </form>
    </AdminCard>
  );
}
