import { Languages } from "lucide-react";
import { usePlatformI18n, type PlatformLocale } from "../../lib/i18n/platformI18n";
import { SelectMenu } from "./SelectMenu";

export function PlatformLanguageToggle() {
  const { locale, setLocale, t } = usePlatformI18n();
  return (
    <SelectMenu
      className="platform-language-menu"
      value={locale}
      label={t("Language")}
      options={[
        { value: "en", label: "English", icon: <Languages size={16} /> },
        { value: "vi", label: "Tiếng Việt", icon: <Languages size={16} /> },
      ]}
      onChange={(value) => setLocale(value as PlatformLocale)}
    />
  );
}
