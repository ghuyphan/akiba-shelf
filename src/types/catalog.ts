export type StockStatus = "in_stock" | "limited" | "sold_out";
export type CatalogLocale = "en" | "vi";
export type StorefrontSection = "featured" | "controls" | "products" | "booth" | "cart";

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

  logo_url?: string;
  instagram_url?: string;
  facebook_url?: string;
  tiktok_url?: string;
  social_qr_logo_url?: string;
  theme_primary?: string;
  theme_secondary?: string;
  theme_accent?: string;
  theme_background?: string;
  layout_order?: StorefrontSection[];
  corner_radius?: number;
  catalog_locale?: CatalogLocale;
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

export type OrderStatus = "pending" | "confirmed" | "cancelled";

export type Order = {
  id: string;
  order_code: string;
  customer_name: string | null;
  total_amount: number;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  product?: Product;
};
