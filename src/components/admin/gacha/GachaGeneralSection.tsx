import { Gamepad2 } from "lucide-react";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";
import type { GachaSettings } from "../../../types/gacha";
import { Field, TextArea, TextInput } from "../../ui/Field";
import { AdminCard } from "../AdminCard";

type Props = {
  settings: GachaSettings;
  titleError?: string;
  onUpdateSettings: (
    changes: Partial<GachaSettings>,
    asTextEdit?: boolean,
  ) => void;
  onTextFocus: () => void;
};

export function GachaGeneralSection({
  settings,
  titleError = "",
  onUpdateSettings,
  onTextFocus,
}: Props) {
  const { t } = usePlatformI18n();

  return (
    <AdminCard
      className="gacha-setup-card"
      icon={<Gamepad2 size={18} />}
      title={t("1 · Status & copy")}
      description={t(
        "Choose whether customers can play and what they see before starting.",
      )}
    >
      <div className="gacha-setup-grid">
        <section className="gacha-panel">
          <header className="gacha-panel-heading">
            <h3>{t("Availability")}</h3>
            <p>{t("Turn this minigame on or off for customers.")}</p>
          </header>
          <div
            className={`gacha-availability ${settings.enabled ? "is-open" : ""}`}
          >
            <label className="gacha-toggle">
              <input
                type="checkbox"
                aria-label={t("Minigame availability")}
                checked={settings.enabled}
                onChange={(event) =>
                  onUpdateSettings({ enabled: event.target.checked })
                }
              />
              <span aria-hidden="true" />
            </label>
            <span className="gacha-availability-copy">
              <strong>{t(settings.enabled ? "Open" : "Closed")}</strong>
              <small>
                {t(
                  settings.enabled
                    ? "Customers can play from the storefront."
                    : "Only staff can preview it until you open it.",
                )}
              </small>
            </span>
          </div>
          <p className="gacha-panel-note">
            {t("Each game keeps its own banners and prize pool.")}
          </p>
        </section>

        <section className="gacha-panel">
          <header className="gacha-panel-heading">
            <h3>{t("Public copy")}</h3>
            <p>
              {t(
                "Name the experience and briefly tell customers what they can win.",
              )}
            </p>
          </header>
          <div className="gacha-copy-fields">
            <Field label={t("Minigame title")} error={titleError}>
              <TextInput
                maxLength={80}
                value={settings.title}
                aria-invalid={Boolean(titleError)}
                onFocus={onTextFocus}
                onChange={(event) =>
                  onUpdateSettings({ title: event.target.value }, true)
                }
              />
            </Field>
            <Field label={t("Introduction")}>
              <TextArea
                maxLength={240}
                value={settings.description}
                onFocus={onTextFocus}
                onChange={(event) =>
                  onUpdateSettings({ description: event.target.value }, true)
                }
              />
            </Field>
          </div>
        </section>
      </div>
    </AdminCard>
  );
}
