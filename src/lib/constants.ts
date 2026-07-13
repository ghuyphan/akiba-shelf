import type { BoothSettings, PaymentSettings } from "../types/catalog";

export const DEFAULT_STOREFRONT_PALETTE = {
  primary: "#d95c64",
  secondary: "#2d2730",
  accent: "#f4cf78",
  background: "#fffaf2",
} as const;

export const defaultBooth: BoothSettings = {
  booth_name: "",
  subtitle: "",
  booth_code: "",
  location: "",
  open_hours: "",

  instagram_url: "",
  facebook_url: "",
  tiktok_url: "",
  social_qr_logo_url: "",
  theme_primary: DEFAULT_STOREFRONT_PALETTE.primary,
  theme_secondary: DEFAULT_STOREFRONT_PALETTE.secondary,
  theme_accent: DEFAULT_STOREFRONT_PALETTE.accent,
  theme_background: DEFAULT_STOREFRONT_PALETTE.background,
  layout_order: ["featured", "booth", "controls", "products", "cart"],
  corner_radius: 16,
  catalog_locale: "en",
  featured_autoplay: true,
};

export const defaultPayment: PaymentSettings = {
  momo_qr_url: "",
  bank_qr_url: "",
  momo_label: "",
  bank_label: "",
  bank_code: "",
  bank_acq_id: "",
  bank_account_no: "",
  bank_account_name: "",
  bank_add_info_template: "",
  payment_instructions: "",
};

export const productBadges = ["New", "Best Seller", "Limited", "Restock", "Event Exclusive", "Preorder", "Last Call"];
export const LIMITED_STOCK_THRESHOLD = 5;
