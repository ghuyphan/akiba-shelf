import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getInitialPlatformLocale,
  savePlatformLocale,
} from "./platformLocaleStorage";
import {
  getPlatformTranslation,
  type PlatformLocale,
  type PlatformTranslationVariables,
} from "./platformTranslations";

type PlatformI18nValue = {
  locale: PlatformLocale;
  setLocale: (locale: PlatformLocale) => void;
  t: (english: string, variables?: PlatformTranslationVariables) => string;
};

const PlatformI18nContext = createContext<PlatformI18nValue | null>(null);

export function PlatformI18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<PlatformLocale>(
    getInitialPlatformLocale,
  );
  const value = useMemo<PlatformI18nValue>(
    () => ({
      locale,
      setLocale(nextLocale) {
        setLocaleState(nextLocale);
        savePlatformLocale(nextLocale);
      },
      t(english, variables) {
        return getPlatformTranslation(english, locale, variables);
      },
    }),
    [locale],
  );

  return (
    <PlatformI18nContext.Provider value={value}>
      {children}
    </PlatformI18nContext.Provider>
  );
}

export function usePlatformI18n() {
  const value = useContext(PlatformI18nContext);
  if (!value)
    throw new Error("usePlatformI18n must be used inside PlatformI18nProvider");
  return value;
}

export {
  getPlatformTranslation,
  platformVietnameseTranslations,
} from "./platformTranslations";
export type {
  PlatformLocale,
  PlatformTranslationVariables,
} from "./platformTranslations";
