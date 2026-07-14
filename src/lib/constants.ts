import type { BoothSettings, PaymentSettings } from "../types/catalog";

export const DEFAULT_STOREFRONT_PALETTE = {
  primary: "#d95c64",
  secondary: "#2d2730",
  accent: "#f4cf78",
  background: "#fffaf2",
} as const;

export const STOREFRONT_PALETTES = [
  { id: "matsuri-bloom", name: "Matsuri Bloom", mood: "Warm & cheerful", ...DEFAULT_STOREFRONT_PALETTE },
  { id: "matcha-picnic", name: "Matcha Picnic", mood: "Cute & cozy", primary: "#5c8657", secondary: "#20304a", accent: "#e6b85c", background: "#fbf7ea" },
  { id: "sakura-soda", name: "Sakura Soda", mood: "Sweet & bubbly", primary: "#e56f92", secondary: "#34263d", accent: "#76c8d6", background: "#fff4f7" },
  { id: "night-market", name: "Night Market", mood: "Cool & electric", primary: "#7b61d1", secondary: "#171a2b", accent: "#ffb84d", background: "#f2efff" },
  { id: "ocean-pop", name: "Ocean Pop", mood: "Fresh & playful", primary: "#347f9c", secondary: "#172b3a", accent: "#f2b85b", background: "#eef8f8" },
] as const;

export const defaultBooth: BoothSettings = {
  booth_name: "",
  subtitle: "",
  booth_code: "",
  location: "",
  open_hours: "",

  instagram_url: "",
  instagram_visible: true,
  facebook_url: "",
  facebook_visible: true,
  tiktok_url: "",
  tiktok_visible: true,
  x_url: "",
  x_visible: true,
  threads_url: "",
  threads_visible: true,
  youtube_url: "",
  youtube_visible: true,
  social_qr_logo_url: "",
  theme_primary: DEFAULT_STOREFRONT_PALETTE.primary,
  theme_secondary: DEFAULT_STOREFRONT_PALETTE.secondary,
  theme_accent: DEFAULT_STOREFRONT_PALETTE.accent,
  theme_background: DEFAULT_STOREFRONT_PALETTE.background,
  layout_order: ["featured", "booth", "controls", "products", "cart"],
  corner_radius: 16,
  card_style: "soft",
  featured_style: "deck",
  controls_style: "panel",
  product_style: "classic",
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
export const SHOP_NAME_MAX_LENGTH = 100;
export const SHOP_SLUG_MIN_LENGTH = 2;
export const SHOP_SLUG_MAX_LENGTH = 63;
export const MAX_OWNED_SHOPS = 5;
export const MAX_SHOP_TEAM_SIZE = 10;
