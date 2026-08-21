import type {
  BoothSettings,
  PaymentSettings,
  PromotionSettings,
} from "../types/catalog";

export const DEFAULT_STOREFRONT_PALETTE = {
  primary: "#d95c64",
  secondary: "#2d2730",
  accent: "#f4cf78",
  background: "#fffaf2",
} as const;

export const STOREFRONT_PALETTES = [
  {
    id: "matsuri-bloom",
    name: "Matsuri Bloom",
    mood: "Warm & cheerful",
    ...DEFAULT_STOREFRONT_PALETTE,
  },
  {
    id: "matcha-picnic",
    name: "Matcha Picnic",
    mood: "Cute & cozy",
    primary: "#4a7251",
    secondary: "#232d25",
    accent: "#dfa94b",
    background: "#f9fbf8",
  },
  {
    id: "sakura-soda",
    name: "Sakura Soda",
    mood: "Sweet & bubbly",
    primary: "#c95376",
    secondary: "#2c222b",
    accent: "#f2aa6b",
    background: "#fdfafb",
  },
  {
    id: "night-market",
    name: "Night Market",
    mood: "Cool & electric",
    primary: "#3d5a80",
    secondary: "#1c2430",
    accent: "#e59846",
    background: "#f8f9fb",
  },
  {
    id: "ocean-pop",
    name: "Ocean Pop",
    mood: "Fresh & playful",
    primary: "#25759e",
    secondary: "#192a38",
    accent: "#e69a3a",
    background: "#f8fafb",
  },
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
  auto_confirm_enabled: false,
  webhook_secret: "",
  payos_client_id: "",
  payos_api_key: "",
  payos_checksum_key: "",
};

export const defaultPromotion: PromotionSettings = {
  enabled: false,
  kind: "buy_get",
  buy_quantity: 3,
  free_quantity: 1,
  repeatable: true,
  percentage_off: 10,
  minimum_subtotal_vnd: 0,
  starts_at: null,
  ends_at: null,
  qualifying_product_ids: [],
  reward_product_ids: [],
};

export const productBadges = [
  "New",
  "Best Seller",
  "Limited",
  "Restock",
  "Event Exclusive",
  "Preorder",
  "Last Call",
];
export const LIMITED_STOCK_THRESHOLD = 5;
export const MAX_FEATURED_PRODUCTS = 8;
export const SHOP_NAME_MAX_LENGTH = 100;
export const SHOP_SLUG_MIN_LENGTH = 2;
export const SHOP_SLUG_MAX_LENGTH = 63;
export const MAX_OWNED_SHOPS = 5;
export const MAX_SHOP_TEAM_SIZE = 10;
