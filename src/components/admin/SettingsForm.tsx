import { FormEvent, useEffect, useState } from "react";
import { Clock3, Edit3, Facebook, Instagram, Link2, MapPin, Palette, Store, Type, X } from "lucide-react";
import { TiktokIcon } from "../ui/TiktokIcon";
import type { BoothSettings } from "../../types/catalog";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Field, TextArea, TextInput } from "../ui/Field";
import { AdminCard } from "./AdminCard";
import { ImageUpload } from "./ImageUpload";

type SettingsFormProps = { settings: BoothSettings; onSave: (settings: BoothSettings) => Promise<void> };

export function SettingsForm({ settings, onSave }: SettingsFormProps) {
  const [draft, setDraft] = useState(settings);
  const [isEditing, setIsEditing] = useState(false);
  const { busy, error, run, setError } = useAsyncAction();
  useEffect(() => { setDraft(settings); setIsEditing(false); setError(""); }, [settings]);
  function resetDraft() { setDraft(settings); setIsEditing(false); setError(""); }
  async function handleSubmit(event: FormEvent) { event.preventDefault(); let saved = false; await run(async () => { await onSave(draft); saved = true; }).catch(() => undefined); if (saved) setIsEditing(false); }

  return (
    <AdminCard title="Booth & appearance" description="Identity, catalog copy, social links, and the public color theme." icon={<Store size={18} />} action={!isEditing ? <Button type="button" variant="secondary" icon={<Edit3 size={17} />} onClick={() => setIsEditing(true)}>Edit settings</Button> : undefined}>
      <form className="admin-form" onSubmit={handleSubmit}>
        {!isEditing && <div className="admin-readout"><span><Store size={16} /><small>Booth</small><strong>{draft.booth_name || "Not set"}</strong></span><span><MapPin size={16} /><small>Code</small><strong>{draft.booth_code || "Not set"}</strong></span><span><Clock3 size={16} /><small>Hours</small><strong>{draft.open_hours || "Not set"}</strong></span></div>}

        <section className="admin-form-section">
          <div className="admin-form-section-heading"><span>01</span><div><h3>Booth identity</h3><p>The name, code, logo, and practical booth details.</p></div></div>
          <div className="admin-logo-editor"><div className="admin-logo-preview">{draft.logo_url ? <img src={draft.logo_url} alt="Booth logo" /> : <Store size={25} />}</div><div><Field label="Logo URL"><TextInput value={draft.logo_url ?? ""} placeholder="https://…" disabled={!isEditing} onChange={(event) => setDraft({ ...draft, logo_url: event.target.value })} /></Field>{isEditing && <ImageUpload bucket="payment-qr" label="Upload logo" onUploaded={(url) => setDraft({ ...draft, logo_url: url })} />}</div></div>
          <div className="form-grid"><Field label="Booth name"><TextInput value={draft.booth_name} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, booth_name: event.target.value })} /></Field><Field label="Booth code"><TextInput value={draft.booth_code} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, booth_code: event.target.value })} /></Field><Field label="Open hours"><TextInput value={draft.open_hours} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, open_hours: event.target.value })} /></Field><Field label="Location"><TextInput value={draft.location} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></Field></div>
        </section>

        <section className="admin-form-section">
          <div className="admin-form-section-heading"><span><Type size={15} /></span><div><h3>Catalog copy</h3><p>The headline and supporting text shown to customers.</p></div></div>
          <Field label="Subtitle"><TextInput value={draft.subtitle} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })} /></Field>
          <div className="form-grid"><Field label="Hero title"><TextInput value={draft.hero_title} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, hero_title: event.target.value })} /></Field><Field label="Hero text"><TextArea value={draft.hero_text} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, hero_text: event.target.value })} /></Field></div>
        </section>

        <section className="admin-form-section">
          <div className="admin-form-section-heading"><span><Link2 size={15} /></span><div><h3>Social QR links</h3><p>Customers can scan these from the booth information panel.</p></div></div>
          <div className="form-grid"><Field label="Instagram URL"><TextInput type="url" value={draft.instagram_url ?? ""} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, instagram_url: event.target.value })} /></Field><Field label="Facebook URL"><TextInput type="url" value={draft.facebook_url ?? ""} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, facebook_url: event.target.value })} /></Field><Field label="TikTok URL"><TextInput type="url" value={draft.tiktok_url ?? ""} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, tiktok_url: event.target.value })} /></Field><Field label="QR center logo"><TextInput value={draft.social_qr_logo_url ?? ""} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, social_qr_logo_url: event.target.value })} /></Field></div>
          <div className="admin-social-preview"><span>{draft.social_qr_logo_url ? <img src={draft.social_qr_logo_url} alt="Social QR logo" /> : <><Instagram size={18} /><Facebook size={18} /><TiktokIcon size={18} /></>}</span><div><strong>Shared QR logo</strong><small>Used in the center of every social QR code.</small></div>{isEditing && <ImageUpload bucket="payment-qr" label="Upload QR logo" onUploaded={(url) => setDraft({ ...draft, social_qr_logo_url: url })} />}</div>
        </section>

        <section className="admin-form-section">
          <div className="admin-form-section-heading"><span><Palette size={15} /></span><div><h3>Catalog theme</h3><p>Keep the palette focused: primary action, dark text, accent, and background.</p></div></div>
          <div className="admin-color-grid">{([['theme_primary','Primary','#ff6fae'],['theme_secondary','Secondary','#24324f'],['theme_accent','Accent','#6fc7ff'],['theme_background','Background','#fff3f8']] as const).map(([key,label,fallback]) => <Field key={key} label={label}><span className="color-field"><input type="color" value={draft[key] ?? fallback} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /><TextInput value={draft[key] ?? ""} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /></span></Field>)}</div>
        </section>

        {error && <Alert variant="error" title="Could not save booth settings" onClose={() => setError("")}>{error}</Alert>}
        {isEditing && <div className="admin-sticky-actions"><Button type="submit" loading={busy} loadingText="Saving…">Save booth settings</Button><Button type="button" variant="secondary" icon={<X size={17} />} disabled={busy} onClick={resetDraft}>Cancel</Button></div>}
      </form>
    </AdminCard>
  );
}
