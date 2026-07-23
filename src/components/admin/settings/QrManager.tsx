import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, Building2, CreditCard, Edit3, MessageSquareText, QrCode, X } from "lucide-react";
import type { PaymentSettings } from "../../../types/catalog";
import { useAsyncAction } from "../../../hooks/useAsyncAction";
import { useToast } from "../../ui/ToastProvider";
import { Button } from "../../ui/Button";
import { Field, TextArea, TextInput } from "../../ui/Field";
import { SelectMenu } from "../../ui/SelectMenu";
import { AdminCard } from "../shell/AdminCard";
import { AdminEditBar } from "../shell/AdminEditBar";
import { ImageUpload } from "../shared/ImageUpload";
import { getBankLogoUrl, getPaymentBank, getVietQrBanks } from "../../../utils/banks";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";
import { useAdminUnsavedChanges } from "../shell/AdminUnsavedChanges";
import { getUserFacingErrorMessage } from "../../../lib/errors";

type QrManagerProps = { shopId: string; settings: PaymentSettings; onSave: (settings: PaymentSettings) => Promise<void> };

export function QrManager({ shopId, settings, onSave }: QrManagerProps) {
  const [draft, setDraft] = useState(settings);
  const [isEditing, setIsEditing] = useState(false);
  const { busy, error, run, setError } = useAsyncAction();
  const toast = useToast();
  const { t } = usePlatformI18n();
  const hasChanges = useMemo(() => JSON.stringify(draft) !== JSON.stringify(settings), [draft, settings]);
  useEffect(() => { if (error) { toast.error(t(getUserFacingErrorMessage(error, "Could not save payment settings")), t("Could not save payment settings")); setError(""); } }, [error, setError, t, toast]);
  const banks = getVietQrBanks();
  const selectedBank = getPaymentBank(draft.bank_code, draft.bank_acq_id);
  useEffect(() => { setDraft(settings); setIsEditing(false); setError(""); }, [settings, setError]);
  const resetDraft = useCallback(() => { setDraft(settings); setIsEditing(false); setError(""); }, [settings, setError]);
  useAdminUnsavedChanges(`payment:${shopId}`, isEditing && hasChanges, resetDraft);
  async function handleSubmit(event: FormEvent) { event.preventDefault(); let saved = false; await run(async () => { await onSave(draft); saved = true; }).catch(() => undefined); if (saved) setIsEditing(false); }

  return (
    <AdminCard title={t("Payment & QR")} description={t("Bank details and payment instructions.")} icon={<QrCode size={18} />} action={!isEditing ? <Button type="button" variant="secondary" icon={<Edit3 size={17} />} onClick={() => setIsEditing(true)}>{t("Edit")}</Button> : undefined}>
      <form className="admin-form" onSubmit={handleSubmit}>
        {!isEditing && <div className="admin-readout"><span><Building2 size={16} /><small>{t("Bank")}</small><strong>{selectedBank?.name ?? t("Not set")}</strong></span><span><CreditCard size={16} /><small>{t("Account")}</small><strong>{draft.bank_account_no || t("Not set")}</strong></span><span><BadgeDollarSign size={16} /><small>{t("Label")}</small><strong>{draft.bank_label || t("Payment")}</strong></span></div>}

        <section className="admin-form-section">
          <div className="admin-form-section-heading"><span>01</span><div><h3>{t("Bank account")}</h3><p>{t("Used to generate each payment QR.")}</p></div></div>
          <div className="admin-bank-card"><img src={getBankLogoUrl(selectedBank)} alt="" onError={(event) => { event.currentTarget.src = getBankLogoUrl(); }} /><div><strong>{selectedBank?.name ?? t("Choose a bank")}</strong><small>{selectedBank?.full_name ?? t("No bank is configured yet")}</small></div><span>{draft.bank_account_no || t("Account not set")}</span></div>
          <div className="form-grid"><Field label={t("Payment label")}><TextInput value={draft.bank_label} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, bank_label: event.target.value })} /></Field><Field label={t("Bank")}><SelectMenu label={t("Bank")} value={selectedBank?.code ?? ""} disabled={!isEditing} options={[{ value: "", label: t("Select bank") }, ...banks.map((bank) => ({ value: bank.code, label: bank.name, description: bank.full_name }))]} onChange={(value) => { const bank = banks.find((item) => item.code === value); setDraft({ ...draft, bank_code: bank?.code ?? "", bank_acq_id: bank?.bin ?? "" }); }} /></Field><Field label={t("Account number")}><TextInput value={draft.bank_account_no ?? ""} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, bank_account_no: event.target.value })} /></Field><Field label={t("Account name")}><TextInput value={draft.bank_account_name ?? ""} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, bank_account_name: event.target.value })} /></Field></div>
        </section>

        <section className="admin-form-section">
          <div className="admin-form-section-heading"><span><MessageSquareText size={15} /></span><div><h3>{t("Transfer message")}</h3><p>{t("Match payments to orders with tokens.")}</p></div></div>
          <Field label={t("Transfer message template")} hint={t("Available tokens: {code}, {item}, {amount}")}><TextInput value={draft.bank_add_info_template ?? ""} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, bank_add_info_template: event.target.value })} /></Field>
          <Field label={t("Customer payment instructions")}><TextArea value={draft.payment_instructions} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, payment_instructions: event.target.value })} /></Field>
        </section>

        <section className="admin-form-section">
          <div className="admin-form-section-heading"><span><QrCode size={15} /></span><div><h3>{t("Backup QR")}</h3><p>{t("Used if VietQR is unavailable.")}</p></div></div>
          <div className="admin-fallback-qr"><div>{draft.bank_qr_url ? <img src={draft.bank_qr_url} alt={t("Fallback payment QR")} /> : <QrCode size={32} />}</div><div><Field label={t("Fallback QR URL")}><TextInput value={draft.bank_qr_url} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, bank_qr_url: event.target.value })} /></Field>{isEditing && <ImageUpload shopId={shopId} bucket="payment-qr" label={t("Upload fallback QR")} onUploaded={(url) => setDraft({ ...draft, bank_qr_url: url })} />}</div></div>
        </section>

        {isEditing && <AdminEditBar status={t(hasChanges ? "Unsaved changes" : "No changes")} statusTone={hasChanges ? "dirty" : "saved"}><Button type="button" variant="secondary" icon={<X size={17} />} disabled={busy} onClick={resetDraft}>{t("Cancel")}</Button><Button type="submit" loading={busy} loadingText={t("Saving…")} disabled={!hasChanges}>{t("Save payment settings")}</Button></AdminEditBar>}
      </form>
    </AdminCard>
  );
}
