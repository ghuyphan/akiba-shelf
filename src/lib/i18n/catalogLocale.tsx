import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { CatalogLocale } from "../../types/catalog";
import { translations, type CatalogCopy } from "./catalogI18n";

const CatalogLocaleContext = createContext<CatalogCopy>(translations.en);

export function CatalogLocaleProvider({
  locale,
  children,
  targetDocument,
}: {
  locale: CatalogLocale;
  children: ReactNode;
  targetDocument?: Document;
}) {
  useEffect(() => {
    const root = (targetDocument ?? document).documentElement;
    const previousLanguage = root.lang;
    root.lang = locale;
    return () => {
      root.lang = previousLanguage || "en";
    };
  }, [locale, targetDocument]);

  return (
    <CatalogLocaleContext.Provider value={translations[locale]}>
      {children}
    </CatalogLocaleContext.Provider>
  );
}

export function useCatalogCopy() {
  return useContext(CatalogLocaleContext);
}
