import { translations } from "../lib/catalogI18n";
import type { AppCopy } from "./types";

export const en: AppCopy = {
  common: { backHome: "Back to home", signIn: "Sign in", signOut: "Sign out", cancel: "Cancel", save: "Save", retry: "Try again", close: "Close", loading: "Loading…", english: "English", vietnamese: "Tiếng Việt" },
  brand: { descriptor: "Merch storefront & live orders", description: "A touch-friendly storefront and live order platform for independent artist booths.", tagline: "Sell smoothly, even at your busiest event." },
  navigation: { language: "Language", selectLanguage: "Select platform language", yourShops: "Your shops" },
  home: { badge: "Now with Multi-Shop Support", title: "Create your dream merch booth", getStarted: "Get started", demo: "View demo shop", storefrontTitle: "Touch-friendly storefront", storefrontBody: "Let customers browse products, inspect details, and build a stock-safe cart in a gorgeous mobile-first storefront.", ordersTitle: "Live orders queue", ordersBody: "Approve payments, manage stock levels, and coordinate staff fulfilment in real time.", designerTitle: "Storefront designer", designerBody: "Customize sections, themes, languages, and corner radiuses in a live preview.", rights: "All rights reserved." },
  auth: { email: "Email address", password: "Password", enterPassword: "Enter your password", forgotPassword: "Forgot password?", createAccount: "Create account", staffSignIn: "Staff sign in", adminContinue: "Use your admin account to continue.", openAdmin: "Open admin", authorisedOnly: "Only authorised staff can access this workspace.", showPassword: (label) => `Show ${label.toLowerCase()}`, hidePassword: (label) => `Hide ${label.toLowerCase()}`, checkingAccess: "Checking your access", loadingWorkspace: "Loading your workspace…" },
  dashboard: { eyebrow: "Your Account", title: "Your shops", description: "Select a shop workspace to manage orders, products, and designs." },
  shopCreation: { title: "Create a shop" },
  admin: { title: (shop) => `${shop} Admin · Matsuri`, orders: "Orders", products: "Products", design: "Storefront", settings: "Settings", team: "Team" },
  orders: { title: "Orders", pending: "Pending", confirmed: "Confirmed", cancelled: "Cancelled", expired: "Expired" },
  products: { title: "Products", add: "Add product" }, staff: { title: "Team & staff", owner: "Owner", admin: "Admin", staff: "Staff" }, settings: { title: "Shop settings" }, payments: { title: "Payment settings" },
  designer: { title: "Storefront Builder", storefrontLanguage: "Storefront language", storefrontLanguageHint: "Customer-facing interface language." }, validation: { required: "This field is required." },
  errors: { generic: "Something went wrong. Check your connection and try again.", signOut: "Could not sign out", supabaseTitle: "Supabase is not configured", supabaseMessage: "Add the Supabase URL and public key before signing in." },
  loading: { preparing: (brand) => `Preparing ${brand}`, ready: "Getting everything ready…" }, accessibility: { loading: (brand) => `Loading ${brand}`, backHome: "Back to home" }, catalog: translations.en,
};

