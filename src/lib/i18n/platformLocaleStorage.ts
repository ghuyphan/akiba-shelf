import type { PlatformLocale } from "./platformTranslations";

export const PLATFORM_LOCALE_STORAGE_KEY = "matsuri-platform-locale";

export function getInitialPlatformLocale(
  storage?: Pick<Storage, "getItem"> | null,
  language?: string,
): PlatformLocale {
  try {
    const activeStorage =
      storage === undefined ? globalThis.localStorage : storage;
    const stored = activeStorage?.getItem(PLATFORM_LOCALE_STORAGE_KEY);
    if (stored === "en" || stored === "vi") return stored;
  } catch {
    // Storage is optional; fall back to the browser language.
  }
  try {
    const activeLanguage = language ?? globalThis.navigator?.language ?? "";
    return activeLanguage.toLowerCase().startsWith("vi") ? "vi" : "en";
  } catch {
    return "en";
  }
}

export function savePlatformLocale(
  locale: PlatformLocale,
  storage?: Pick<Storage, "setItem"> | null,
) {
  try {
    const activeStorage =
      storage === undefined ? globalThis.localStorage : storage;
    activeStorage?.setItem(PLATFORM_LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage is optional; the current session still updates.
  }
}
