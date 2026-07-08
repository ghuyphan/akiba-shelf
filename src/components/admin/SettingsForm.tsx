import { FormEvent, useEffect, useState } from "react";
import { Clock3, Edit3, Facebook, Instagram, Link2, MapPin, Music2, Palette, Store, X } from "lucide-react";
import type { BoothSettings } from "../../types/catalog";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Field, TextArea, TextInput } from "../ui/Field";
import { AdminCard } from "./AdminCard";
import { ImageUpload } from "./ImageUpload";

type SettingsFormProps = {
  settings: BoothSettings;
  onSave: (settings: BoothSettings) => Promise<void>;
};

export function SettingsForm({ settings, onSave }: SettingsFormProps) {
  const [draft, setDraft] = useState(settings);
  const [isEditing, setIsEditing] = useState(false);
  const { busy, error, run, setError } = useAsyncAction();

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
      title="Booth Info"
      description="Review booth copy and theme colors. Edit only when public catalog details need to change."
      icon={<Store size={18} />}
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
          <div className="admin-readout" aria-label="Booth summary">
            <span>
              <Store size={16} />
              <small>Booth</small>
              <strong>{draft.booth_name || "Not set"}</strong>
            </span>
            <span>
              <MapPin size={16} />
              <small>Code</small>
              <strong>{draft.booth_code || "Not set"}</strong>
            </span>
            <span>
              <Clock3 size={16} />
              <small>Hours</small>
              <strong>{draft.open_hours || "Not set"}</strong>
            </span>
          </div>
        )}
        <div className="form-grid">
          <Field label="Booth Name">
            <TextInput
              value={draft.booth_name}
              disabled={!isEditing}
              onChange={(event) => setDraft({ ...draft, booth_name: event.target.value })}
            />
          </Field>
          <Field label="Booth Code">
            <TextInput
              value={draft.booth_code}
              disabled={!isEditing}
              onChange={(event) => setDraft({ ...draft, booth_code: event.target.value })}
            />
          </Field>
          <Field label="Subtitle">
            <TextInput value={draft.subtitle} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })} />
          </Field>
          <Field label="Open Hours">
            <TextInput
              value={draft.open_hours}
              disabled={!isEditing}
              onChange={(event) => setDraft({ ...draft, open_hours: event.target.value })}
            />
          </Field>
        </div>
        <Field label="Location">
          <TextInput value={draft.location} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, location: event.target.value })} />
        </Field>
        <Field label="Hero Title">
          <TextInput value={draft.hero_title} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, hero_title: event.target.value })} />
        </Field>
        <Field label="Hero Text">
          <TextArea value={draft.hero_text} disabled={!isEditing} onChange={(event) => setDraft({ ...draft, hero_text: event.target.value })} />
        </Field>
        <div className="social-settings-grid">
          <div className="palette-heading">
            <Link2 size={17} />
            <span>Social QR Links</span>
          </div>
          <Field label="Instagram URL">
            <TextInput
              type="url"
              value={draft.instagram_url ?? ""}
              disabled={!isEditing}
              onChange={(event) => setDraft({ ...draft, instagram_url: event.target.value })}
            />
          </Field>
          <Field label="Facebook URL">
            <TextInput
              type="url"
              value={draft.facebook_url ?? ""}
              disabled={!isEditing}
              onChange={(event) => setDraft({ ...draft, facebook_url: event.target.value })}
            />
          </Field>
          <Field label="TikTok URL">
            <TextInput
              type="url"
              value={draft.tiktok_url ?? ""}
              disabled={!isEditing}
              onChange={(event) => setDraft({ ...draft, tiktok_url: event.target.value })}
            />
          </Field>
          <div className="social-logo-admin">
            <div className="social-logo-preview" aria-label="Social QR logo preview">
              {draft.social_qr_logo_url ? (
                <img src={draft.social_qr_logo_url} alt="Social QR logo" />
              ) : (
                <span>
                  <Instagram size={17} />
                  <Facebook size={17} />
                  <Music2 size={17} />
                </span>
              )}
            </div>
            <Field label="QR Center Logo URL">
              <TextInput
                value={draft.social_qr_logo_url ?? ""}
                disabled={!isEditing}
                onChange={(event) => setDraft({ ...draft, social_qr_logo_url: event.target.value })}
              />
            </Field>
            {isEditing ? (
              <ImageUpload
                bucket="payment-qr"
                label="Upload Logo"
                onUploaded={(url) => setDraft({ ...draft, social_qr_logo_url: url })}
              />
            ) : (
              <div className="image-admin-note">Logo upload is available while editing.</div>
            )}
          </div>
        </div>
        <div className="palette-grid">
          <div className="palette-heading">
            <Palette size={17} />
            <span>Catalog Theme</span>
          </div>
          <Field label="Primary">
            <span className="color-field">
              <input
                type="color"
                value={draft.theme_primary ?? "#ff6fae"}
                disabled={!isEditing}
                onChange={(event) => setDraft({ ...draft, theme_primary: event.target.value })}
              />
              <TextInput
                value={draft.theme_primary ?? ""}
                disabled={!isEditing}
                onChange={(event) => setDraft({ ...draft, theme_primary: event.target.value })}
              />
            </span>
          </Field>
          <Field label="Secondary">
            <span className="color-field">
              <input
                type="color"
                value={draft.theme_secondary ?? "#24324f"}
                disabled={!isEditing}
                onChange={(event) => setDraft({ ...draft, theme_secondary: event.target.value })}
              />
              <TextInput
                value={draft.theme_secondary ?? ""}
                disabled={!isEditing}
                onChange={(event) => setDraft({ ...draft, theme_secondary: event.target.value })}
              />
            </span>
          </Field>
          <Field label="Accent">
            <span className="color-field">
              <input
                type="color"
                value={draft.theme_accent ?? "#6fc7ff"}
                disabled={!isEditing}
                onChange={(event) => setDraft({ ...draft, theme_accent: event.target.value })}
              />
              <TextInput
                value={draft.theme_accent ?? ""}
                disabled={!isEditing}
                onChange={(event) => setDraft({ ...draft, theme_accent: event.target.value })}
              />
            </span>
          </Field>
          <Field label="Background">
            <span className="color-field">
              <input
                type="color"
                value={draft.theme_background ?? "#fff3f8"}
                disabled={!isEditing}
                onChange={(event) => setDraft({ ...draft, theme_background: event.target.value })}
              />
              <TextInput
                value={draft.theme_background ?? ""}
                disabled={!isEditing}
                onChange={(event) => setDraft({ ...draft, theme_background: event.target.value })}
              />
            </span>
          </Field>
        </div>
        {error && (
          <Alert variant="error" title="Could not save booth info" onClose={() => setError("")}>
            {error}
          </Alert>
        )}
        {isEditing && (
          <div className="form-actions">
            <Button type="submit" loading={busy} loadingText="Saving...">
              Save Booth Info
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
