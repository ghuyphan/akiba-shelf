export type StockStatus = "in_stock" | "limited" | "sold_out";
export type CatalogLocale = "en" | "vi";
export type StorefrontCardStyle = "soft" | "outlined" | "elevated" | "playful";
export type StorefrontFeaturedStyle = "deck" | "editorial" | "minimal" | "poster";
export type StorefrontControlsStyle = "panel" | "floating" | "compact" | "playful";
export type StorefrontProductStyle = "classic" | "minimal" | "framed" | "playful";
export type StorefrontSection = "featured" | "controls" | "products" | "booth" | "cart";
export type ShopRole = "owner" | "admin" | "staff";

export type Shop = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  accepting_orders: boolean;
  catalog_source_shop_id?: string | null;
};
export type ShopMembership = { shop_id: string; shop_name: string; shop_slug: string; role: ShopRole; active: boolean; shop_active: boolean };

export type Product = {
  shop_id?: string;
  id: string;
  name: string;
  collection: string;
  description: string;
  price_vnd: number;
  sale_price_vnd?: number | null;
  effective_price_vnd?: number;
  promotion_eligible?: boolean;
  item_code: string;
  quantity_available: number;
  category: string;
  badge?: string;
  badge_color?: string;
  stock_status: StockStatus;
  stock_note: string;
  images: string[];
  image_variants?: Array<{ thumbnail: string; detail: string }>;
  image_paths?: string[];
  featured: boolean;
  sort_order: number;
  active: boolean;
};

export type BoothSettings = {
  shop_id?: string;
  id?: string;
  booth_name: string;
  subtitle: string;
  booth_code: string;
  location: string;
  open_hours: string;

  logo_url?: string;
  logo_path?: string;
  instagram_url?: string;
  instagram_visible?: boolean;
  facebook_url?: string;
  facebook_visible?: boolean;
  tiktok_url?: string;
  tiktok_visible?: boolean;
  x_url?: string;
  x_visible?: boolean;
  threads_url?: string;
  threads_visible?: boolean;
  youtube_url?: string;
  youtube_visible?: boolean;
  social_qr_logo_url?: string;
  social_qr_logo_path?: string;
  theme_primary?: string;
  theme_secondary?: string;
  theme_accent?: string;
  theme_background?: string;
  layout_order?: StorefrontSection[];
  corner_radius?: number;
  card_style?: StorefrontCardStyle;
  featured_style?: StorefrontFeaturedStyle;
  controls_style?: StorefrontControlsStyle;
  product_style?: StorefrontProductStyle;
  catalog_locale?: CatalogLocale;
  featured_autoplay?: boolean;
};

export type PaymentSettings = {
  shop_id?: string;
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

export type PromotionSettings = {
  shop_id?: string;
  enabled: boolean;
  buy_quantity: number;
  free_quantity: number;
  repeatable: boolean;
  qualifying_product_ids: string[];
  reward_product_ids: string[];
};

export type CatalogData = {
  products: Product[];
  booth: BoothSettings;
  payment: PaymentSettings;
  promotion: PromotionSettings;
};

export type CartItem = {
  product: Product;
  quantity: number;
  reward_quantity?: number;
};

export type OrderStatus = "pending" | "confirmed" | "cancelled" | "expired";

export type Order = {
  shop_id?: string;
  id: string;
  order_code: string;
  customer_name: string | null;
  total_amount: number;
  discount_amount?: number;
  free_quantity?: number;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  expired_at: string | null;
  order_items?: OrderItem[];
};

export type OrderMutationOutcome = "confirmed" | "cancelled" | "expired" | "already_confirmed" | "already_cancelled" | "already_expired" | "not_found" | "invalid_state";
export type OrderMutationResult = { outcome: OrderMutationOutcome; order: Order | null };

export type OrderItemProduct = Pick<Product, "id" | "name" | "item_code" | "images">;

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount_amount?: number;
  product?: OrderItemProduct;
};
