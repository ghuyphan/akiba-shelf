import type { BoothSettings } from "../../../types/catalog";
import {
  getStorefrontColorGuidance,
  getStorefrontPalette,
  getStorefrontRoleColors,
  type StorefrontColorRole,
} from "../../../utils/storefrontColors";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";
import { ColorPicker } from "../../ui/ColorPicker";

type StorefrontThemeColorPickerProps = {
  role: StorefrontColorRole;
  label: string;
  value: string;
  settings: BoothSettings;
  disabled?: boolean;
  onChange: (value: string) => void;
};

export function StorefrontThemeColorPicker({
  role,
  label,
  value,
  settings,
  disabled,
  onChange,
}: StorefrontThemeColorPickerProps) {
  const { t } = usePlatformI18n();
  const guidance = getStorefrontColorGuidance(
    role,
    getStorefrontPalette(settings),
  );
  const surface = t(guidance.referenceLabel);
  const ratio = guidance.ratio.toFixed(1);

  return (
    <ColorPicker
      label={label}
      value={value}
      colors={getStorefrontRoleColors(role)}
      disabled={disabled}
      recommendation={{
        color: guidance.recommended,
        label: guidance.passes
          ? t("Accessible contrast")
          : t("Recommended accessible shade"),
        description: guidance.passes
          ? t("{{ratio}}:1 against {{surface}}.", { ratio, surface })
          : t(
              "Current {{ratio}}:1; target {{target}}:1 against {{surface}}.",
              {
                ratio,
                target: guidance.target.toFixed(1),
                surface,
              },
            ),
        actionLabel: t("Use {{color}}", { color: guidance.recommended }),
      }}
      onChange={onChange}
    />
  );
}
