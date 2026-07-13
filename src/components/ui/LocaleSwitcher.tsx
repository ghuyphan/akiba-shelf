import { Languages } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { isAppLocale } from "../../lib/locale";
import { SelectMenu } from "./SelectMenu";

export function LocaleSwitcher({ variant = "header" }: { variant?: "header" | "auth" }) {
  const { locale, setLocale, copy } = useI18n();
  return <SelectMenu value={locale} onChange={(value) => { if (isAppLocale(value)) setLocale(value); }} label={copy.navigation.selectLanguage} className={`locale-switcher locale-switcher-${variant}`} options={[
    { value: "en", label: copy.common.english, description: "EN", icon: <Languages size={16} aria-hidden="true" /> },
    { value: "vi", label: copy.common.vietnamese, description: "VI", icon: <Languages size={16} aria-hidden="true" /> },
  ]} />;
}

