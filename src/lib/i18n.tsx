import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { en } from "../locales/en";
import { vi } from "../locales/vi";
import type { AppCopy, AppLocale } from "../locales/types";
import { isAppLocale, localeCode, PLATFORM_LOCALE_KEY, resolvePlatformLocale } from "./locale";

const copies = { en, vi } satisfies Record<AppLocale, AppCopy>;
type I18nValue = { locale: AppLocale; setLocale: (locale: AppLocale) => void; copy: AppCopy; formatNumber: (value: number) => string; formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string; formatCurrency: (value: number) => string };
const defaultCode = localeCode("en");
const defaultValue: I18nValue = { locale: "en", setLocale: () => undefined, copy: en, formatNumber: (value) => new Intl.NumberFormat(defaultCode).format(value), formatDate: (value, options) => new Intl.DateTimeFormat(defaultCode, options).format(new Date(value)), formatCurrency: (value) => new Intl.NumberFormat(defaultCode, { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value) };
const I18nContext = createContext<I18nValue>(defaultValue);

export function I18nProvider({ children, initialLocale }: { children: ReactNode; initialLocale?: AppLocale }) {
  const { pathname } = useLocation();
  const [locale, updateLocale] = useState<AppLocale>(() => initialLocale ?? resolvePlatformLocale());
  const setLocale = useCallback((next: AppLocale) => { updateLocale(next); localStorage.setItem(PLATFORM_LOCALE_KEY, next); }, []);
  useEffect(() => { if (!pathname.startsWith("/s/")) document.documentElement.lang = locale; }, [locale, pathname]);
  useEffect(() => { const sync = (event: StorageEvent) => { if (event.key === PLATFORM_LOCALE_KEY && isAppLocale(event.newValue)) updateLocale(event.newValue); }; window.addEventListener("storage", sync); return () => window.removeEventListener("storage", sync); }, []);
  const code = localeCode(locale);
  const value = useMemo<I18nValue>(() => ({ locale, setLocale, copy: copies[locale], formatNumber: (value) => new Intl.NumberFormat(code).format(value), formatDate: (value, options) => new Intl.DateTimeFormat(code, options).format(new Date(value)), formatCurrency: (value) => new Intl.NumberFormat(code, { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value) }), [code, locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() { return useContext(I18nContext); }
