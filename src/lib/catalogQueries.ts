import type { Product } from "../types/catalog";

export type PublicProductSort =
  | "recommended"
  | "price-asc"
  | "price-desc"
  | "quantity"
  | "name";

export type LocalCatalogQuery = {
  category: string;
  search: string;
  sort: PublicProductSort;
};

export function queryLocalCatalog(
  products: Product[],
  query: LocalCatalogQuery,
  offset: number,
  pageSize: number,
) {
  let filtered = products.filter((product) => product.active);
  if (query.category && query.category !== "All")
    filtered = filtered.filter((product) => product.category === query.category);

  const search = query.search.trim().toLocaleLowerCase();
  if (search) {
    filtered = filtered.filter((product) =>
      [product.name, product.item_code, product.collection, product.description]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase().includes(search)),
    );
  }

  filtered.sort((first, second) => {
    if (query.sort === "price-asc")
      return (first.effective_price_vnd ?? first.price_vnd) -
        (second.effective_price_vnd ?? second.price_vnd);
    if (query.sort === "price-desc")
      return (second.effective_price_vnd ?? second.price_vnd) -
        (first.effective_price_vnd ?? first.price_vnd);
    if (query.sort === "quantity")
      return second.quantity_available - first.quantity_available;
    if (query.sort === "name") return first.name.localeCompare(second.name);
    if (first.featured !== second.featured) return first.featured ? -1 : 1;
    if (first.sort_order !== second.sort_order)
      return first.sort_order - second.sort_order;
    return first.id.localeCompare(second.id);
  });

  const safeOffset = Math.max(0, offset);
  const safePageSize = Math.max(1, pageSize);
  return {
    products: filtered.slice(safeOffset, safeOffset + safePageSize),
    hasMore: safeOffset + safePageSize < filtered.length,
  };
}

export const PUBLIC_PRODUCT_COLUMNS =
  "id,shop_id,name,collection,description,price_vnd,sale_price_vnd,effective_price_vnd,promotion_eligible,item_code,quantity_available,category,badge,badge_color,stock_status,stock_note,images,image_variants,featured,sort_order,active";
export const ADMIN_PRODUCT_COLUMNS = `${PUBLIC_PRODUCT_COLUMNS},image_paths`;

export const PUBLIC_BOOTH_COLUMNS =
  "id,shop_id,booth_name,subtitle,booth_code,location,open_hours,logo_url,instagram_url,instagram_visible,facebook_url,facebook_visible,tiktok_url,tiktok_visible,x_url,x_visible,threads_url,threads_visible,youtube_url,youtube_visible,social_qr_logo_url,theme_primary,theme_secondary,theme_accent,theme_background,layout_order,corner_radius,card_style,featured_style,controls_style,product_style,catalog_locale,featured_autoplay";
export const ADMIN_BOOTH_COLUMNS = `${PUBLIC_BOOTH_COLUMNS},logo_path,social_qr_logo_path`;

export const PUBLIC_PAYMENT_COLUMNS =
  "id,shop_id,momo_qr_url,bank_qr_url,momo_label,bank_label,bank_code,bank_acq_id,bank_account_no,bank_account_name,bank_add_info_template,payment_instructions";
export const ADMIN_PAYMENT_COLUMNS = PUBLIC_PAYMENT_COLUMNS;
