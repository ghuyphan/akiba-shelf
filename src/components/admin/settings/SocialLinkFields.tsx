import type { BoothSettings } from "../../../types/catalog";
import { SOCIAL_PLATFORMS } from "../../../utils/social";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";
import { SocialBrandIcon } from "../../ui/SocialBrandIcon";
import { TextInput } from "../../ui/Field";

export function SocialLinkFields({
  settings,
  disabled = false,
  onChange,
}: {
  settings: BoothSettings;
  disabled?: boolean;
  onChange: (settings: BoothSettings) => void;
}) {
  const { t } = usePlatformI18n();

  return (
    <div className="social-channel-grid">
      {SOCIAL_PLATFORMS.map((platform) => {
        const visible = settings[platform.visibleKey] ?? true;
        return (
          <section
            key={platform.label}
            className={`social-channel-field ${visible ? "" : "is-hidden"}`}
            style={{ "--social-channel-color": platform.color } as React.CSSProperties}
          >
            <div className="social-channel-field-head">
              <span aria-hidden="true">
                <SocialBrandIcon platform={platform.label} size={16} />
              </span>
              <strong>{platform.label}</strong>
              <label className="social-channel-visibility">
                <input
                  type="checkbox"
                  checked={visible}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({
                      ...settings,
                      [platform.visibleKey]: event.target.checked,
                    })
                  }
                />
                <span>{t("Show")}</span>
              </label>
            </div>
            <TextInput
              type="url"
              value={settings[platform.urlKey] ?? ""}
              disabled={disabled}
              placeholder={t("Profile URL")}
              aria-label={t("{{platform}} profile URL", {
                platform: platform.label,
              })}
              onChange={(event) =>
                onChange({
                  ...settings,
                  [platform.urlKey]: event.target.value,
                })
              }
            />
          </section>
        );
      })}
    </div>
  );
}
