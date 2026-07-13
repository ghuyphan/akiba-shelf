import type { AppLocale, LocaleCode } from "../locales/types";

export const PLATFORM_LOCALE_KEY = "matsuri-platform-locale";
export const isAppLocale = (value: unknown): value is AppLocale => value === "en" || value === "vi";
export const localeCode = (locale: AppLocale): LocaleCode => locale === "vi" ? "vi-VN" : "en-US";
export function resolvePlatformLocale(storage: Pick<Storage, "getItem"> | null = typeof localStorage === "undefined" ? null : localStorage, language = typeof navigator === "undefined" ? "en" : navigator.language): AppLocale {
  const saved = storage?.getItem(PLATFORM_LOCALE_KEY);
  if (isAppLocale(saved)) return saved;
  return language.toLowerCase().startsWith("vi") ? "vi" : "en";
}

