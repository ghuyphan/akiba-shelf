import { FormEvent, useEffect, useState } from "react";
import type { BoothSettings } from "../../types/catalog";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Field, TextArea, TextInput } from "../ui/Field";
import { AdminCard } from "./AdminCard";

type SettingsFormProps = {
  settings: BoothSettings;
  onSave: (settings: BoothSettings) => Promise<void>;
};

export function SettingsForm({ settings, onSave }: SettingsFormProps) {
  const [draft, setDraft] = useState(settings);
  const { busy, error, run, setError } = useAsyncAction();

  useEffect(() => setDraft(settings), [settings]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await run(() => onSave(draft)).catch(() => undefined);
  }

  return (
    <AdminCard title="Booth Info" description="Shown in the catalog header and info panel.">
      <form className="admin-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <Field label="Booth Name">
            <TextInput value={draft.booth_name} onChange={(event) => setDraft({ ...draft, booth_name: event.target.value })} />
          </Field>
          <Field label="Booth Code">
            <TextInput value={draft.booth_code} onChange={(event) => setDraft({ ...draft, booth_code: event.target.value })} />
          </Field>
          <Field label="Subtitle">
            <TextInput value={draft.subtitle} onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })} />
          </Field>
          <Field label="Open Hours">
            <TextInput value={draft.open_hours} onChange={(event) => setDraft({ ...draft, open_hours: event.target.value })} />
          </Field>
        </div>
        <Field label="Location">
          <TextInput value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} />
        </Field>
        <Field label="Hero Title">
          <TextInput value={draft.hero_title} onChange={(event) => setDraft({ ...draft, hero_title: event.target.value })} />
        </Field>
        <Field label="Hero Text">
          <TextArea value={draft.hero_text} onChange={(event) => setDraft({ ...draft, hero_text: event.target.value })} />
        </Field>
        <div className="palette-grid">
          <Field label="Primary">
            <span className="color-field">
              <input
                type="color"
                value={draft.theme_primary ?? "#ff6fae"}
                onChange={(event) => setDraft({ ...draft, theme_primary: event.target.value })}
              />
              <TextInput value={draft.theme_primary ?? ""} onChange={(event) => setDraft({ ...draft, theme_primary: event.target.value })} />
            </span>
          </Field>
          <Field label="Secondary">
            <span className="color-field">
              <input
                type="color"
                value={draft.theme_secondary ?? "#24324f"}
                onChange={(event) => setDraft({ ...draft, theme_secondary: event.target.value })}
              />
              <TextInput value={draft.theme_secondary ?? ""} onChange={(event) => setDraft({ ...draft, theme_secondary: event.target.value })} />
            </span>
          </Field>
          <Field label="Accent">
            <span className="color-field">
              <input
                type="color"
                value={draft.theme_accent ?? "#6fc7ff"}
                onChange={(event) => setDraft({ ...draft, theme_accent: event.target.value })}
              />
              <TextInput value={draft.theme_accent ?? ""} onChange={(event) => setDraft({ ...draft, theme_accent: event.target.value })} />
            </span>
          </Field>
          <Field label="Background">
            <span className="color-field">
              <input
                type="color"
                value={draft.theme_background ?? "#fff3f8"}
                onChange={(event) => setDraft({ ...draft, theme_background: event.target.value })}
              />
              <TextInput
                value={draft.theme_background ?? ""}
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
        <Button type="submit" loading={busy} loadingText="Saving...">
          Save Booth Info
        </Button>
      </form>
    </AdminCard>
  );
}
