import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, Edit3, Link2, MapPin, Store, Type, X } from "lucide-react";
import type { BoothSettings } from "../../../types/catalog";
import { useAsyncAction } from "../../../hooks/shared/useAsyncAction";
import { useToast } from "../../ui/ToastProvider";
import { Button } from "../../ui/Button";
import { Field, TextInput } from "../../ui/Field";
import { AdminCard } from "../shell/AdminCard";
import { AdminEditBar } from "../shell/AdminEditBar";
import { ImageUpload } from "../shared/ImageUpload";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";
import { SocialLinkFields } from "./SocialLinkFields";
import { SocialBrandIcon } from "../../ui/SocialBrandIcon";
import { useAdminUnsavedChanges } from "../shell/AdminUnsavedChanges";
import { getUserFacingErrorMessage } from "../../../lib/errors";

type SettingsFormProps = { shopId: string; settings: BoothSettings; onSave: (settings: BoothSettings) => Promise<void> };

export function SettingsForm({ shopId, settings, onSave }: SettingsFormProps) {
  const [draft, setDraft] = useState(settings);
  const [isEditing, setIsEditing] = useState(false);
  const { busy, error, run, setError } = useAsyncAction();
  const toast = useToast();
  const { t } = usePlatformI18n();
  const hasChanges = useMemo(() => JSON.stringify(draft) !== JSON.stringify(settings), [draft, settings]);
  useEffect(() => { if (error) { toast.error(t(getUserFacingErrorMessage(error, "Could not save booth settings")), t("Could not save booth settings")); setError(""); } }, [error, setError, t, toast]);
  useEffect(() => { setDraft(settings); setIsEditing(false); setError(""); }, [settings, setError]);
  const resetDraft = useCallback(() => { setDraft(settings); setIsEditing(false); setError(""); }, [settings, setError]);
  useAdminUnsavedChanges(`settings:${shopId}`, isEditing && hasChanges, resetDraft);
  async function handleSubmit(event: FormEvent) { event.preventDefault(); let saved = false; await run(async () => { await onSave(draft); saved = true; }).catch(() => undefined); if (saved) setIsEditing(false); }

  return (
    <AdminCard title={t("Booth info")} description={t("Name, logo, location, and social links.")} icon={<Store size={18} />} action={!isEditing ? <Button type="button" variant="secondary" icon={<Edit3 size={17} />} onClick={() => setIsEditing(true)}>{t("Edit")}</Button> : undefined}>
      <form className="admin-form" onSubmit={handleSubmit}>
        {!isEditing && <div className="admin-readout"><span><Store size={16} /><small>{t("Booth")}</small><strong>{draft.booth_name || t("Not set")}</strong></span><span><MapPin size={16} /><small>{t("Code")}</small><strong>{draft.booth_code || t("Not set")}</strong></span><span><Clock3 size={16} /><small>{t("Hours")}</small><strong>{draft.open_hours || t("Not set")}</strong></span></div>}

        <section className="admin-form-section">
          <div className="admin-form-section-heading"><span>01</span><div><h3>{t("Booth identity")}</h3><p>{t("Name, code, logo, hours, and location.")}</p></div></div>
          <div className="admin-logo-editor"><div className="admin-logo-preview">{draft.logo_url ? <img src={draft.logo_url} alt={t("Booth logo")} /> : <Store size={25} />}</div><div><Field label={t("Logo URL")}><TextInput value={draft.logo_url ?? ""} placeholder="https://…" disabled={!isEditing} onChange={(event) => setDraft({ ...draft, logo_url: event.target.value, logo_path: undefined })} /></Field>{isEditing && <ImageUpload shopId={shopId} bucket="payment-qr" label={t("Upload logo")} onUploaded={(url, path) => setDraft({ ...draft, logo_url: url, logo_path: path })} />}</div></div>
          <div className="form-grid"><Field label={t("Booth name")}><TextInput value={draft.booth_name} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, booth_name: event.target.value })} /></Field><Field label={t("Booth code")}><TextInput value={draft.booth_code} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, booth_code: event.target.value })} /></Field><Field label={t("Open hours")}><TextInput value={draft.open_hours} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, open_hours: event.target.value })} /></Field><Field label={t("Location")}><TextInput value={draft.location} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></Field></div>
        </section>

        <section className="admin-form-section">
          <div className="admin-form-section-heading"><span><Type size={15} /></span><div><h3>{t("Store copy")}</h3><p>{t("Customer-facing title and description.")}</p></div></div>
          <Field label={t("Subtitle")}><TextInput value={draft.subtitle} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })} /></Field>
        </section>

        <section className="admin-form-section">
          <div className="admin-form-section-heading"><span><Link2 size={15} /></span><div><h3>{t("Social links")}</h3><p>{t("Links shown in booth information.")}</p></div></div>
          <SocialLinkFields settings={draft} disabled={!isEditing} onChange={setDraft} />
          <Field label={t("QR center logo")}><TextInput value={draft.social_qr_logo_url ?? ""} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, social_qr_logo_url: event.target.value })} /></Field>
          <div className="admin-social-preview"><span>{draft.social_qr_logo_url ? <img src={draft.social_qr_logo_url} alt={t("Social QR logo")} /> : <><SocialBrandIcon platform="Instagram" size={17} /><SocialBrandIcon platform="Threads" size={17} /><SocialBrandIcon platform="YouTube" size={17} /></>}</span><div><strong>{t("Shared QR logo")}</strong><small>{t("Used in the center of every social QR code.")}</small></div>{isEditing && <ImageUpload shopId={shopId} bucket="payment-qr" label={t("Upload QR logo")} onUploaded={(url, path) => setDraft({ ...draft, social_qr_logo_url: url, social_qr_logo_path: path })} />}</div>
        </section>

        {isEditing && <AdminEditBar status={t(hasChanges ? "Unsaved changes" : "No changes")} statusTone={hasChanges ? "dirty" : "saved"}><Button type="button" variant="secondary" icon={<X size={17} />} disabled={busy} onClick={resetDraft}>{t("Cancel")}</Button><Button type="submit" loading={busy} loadingText={t("Saving…")} disabled={!hasChanges}>{t("Save booth settings")}</Button></AdminEditBar>}
      </form>
    </AdminCard>
  );
}
