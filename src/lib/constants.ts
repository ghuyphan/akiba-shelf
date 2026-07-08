import type { BoothSettings, PaymentSettings } from "../types/catalog";

export const defaultBooth: BoothSettings = {
  booth_name: "",
  subtitle: "",
  booth_code: "",
  location: "",
  open_hours: "",
  hero_title: "",
  hero_text: "",
  instagram_url: "",
  facebook_url: "",
  tiktok_url: "",
  social_qr_logo_url: "",
  theme_primary: "#ff6fae",
  theme_secondary: "#24324f",
  theme_accent: "#6fc7ff",
  theme_background: "#fff3f8",
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
