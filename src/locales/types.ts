import type { translations } from "../lib/catalogI18n";

export type AppLocale = "en" | "vi";
export type LocaleCode = "en-US" | "vi-VN";
export type CatalogCopy = (typeof translations)["en"] | (typeof translations)["vi"];

export type AppCopy = {
  common: {
    backHome: string; signIn: string; signOut: string; cancel: string; save: string;
    retry: string; close: string; loading: string; english: string; vietnamese: string;
  };
  brand: { descriptor: string; description: string; tagline: string };
  navigation: { language: string; selectLanguage: string; yourShops: string };
  home: {
    badge: string; title: string; getStarted: string; demo: string;
    storefrontTitle: string; storefrontBody: string; ordersTitle: string; ordersBody: string;
    designerTitle: string; designerBody: string; rights: string;
  };
  auth: {
    email: string; password: string; enterPassword: string; forgotPassword: string;
    createAccount: string; staffSignIn: string; adminContinue: string; openAdmin: string;
    authorisedOnly: string; showPassword: (label: string) => string; hidePassword: (label: string) => string;
    checkingAccess: string; loadingWorkspace: string;
  };
  dashboard: { eyebrow: string; title: string; description: string };
  shopCreation: { title: string };
  admin: { title: (shop: string) => string; orders: string; products: string; design: string; settings: string; team: string };
  orders: { title: string; pending: string; confirmed: string; cancelled: string; expired: string };
  products: { title: string; add: string };
  staff: { title: string; owner: string; admin: string; staff: string };
  settings: { title: string };
  payments: { title: string };
  designer: { title: string; storefrontLanguage: string; storefrontLanguageHint: string };
  validation: { required: string };
  errors: { generic: string; signOut: string; supabaseTitle: string; supabaseMessage: string };
  loading: { preparing: (brand: string) => string; ready: string };
  accessibility: { loading: (brand: string) => string; backHome: string };
  catalog: CatalogCopy;
};

