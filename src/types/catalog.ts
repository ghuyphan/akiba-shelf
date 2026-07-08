export type StockStatus = "in_stock" | "limited" | "sold_out";

export type Product = {
  id: string;
  name: string;
  collection: string;
  description: string;
  price_vnd: number;
  item_code: string;
  quantity_available: number;
  category: string;
  badge?: string;
  stock_status: StockStatus;
  stock_note: string;
  images: string[];
  featured: boolean;
  sort_order: number;
  active: boolean;
};

export type BoothSettings = {
  id?: string;
  booth_name: string;
  subtitle: string;
  booth_code: string;
  location: string;
  open_hours: string;
  hero_title: string;
  hero_text: string;
  logo_url?: string;
  instagram_url?: string;
  facebook_url?: string;
  tiktok_url?: string;
  social_qr_logo_url?: string;
  theme_primary?: string;
  theme_secondary?: string;
  theme_accent?: string;
  theme_background?: string;
};

export type PaymentSettings = {
  id?: string;
  momo_qr_url: string;
  bank_qr_url: string;
  momo_label: string;
  bank_label: string;
  bank_code?: string;
  bank_acq_id?: string;
  bank_account_no?: string;
  bank_account_name?: string;
  bank_add_info_template?: string;
  payment_instructions: string;
};

export type CatalogData = {
  products: Product[];
  booth: BoothSettings;
  payment: PaymentSettings;
};

export type CartItem = {
  product: Product;
  quantity: number;
};

