export const PUBLIC_PRODUCT_COLUMNS =
  "id,shop_id,name,collection,description,price_vnd,sale_price_vnd,effective_price_vnd,item_code,quantity_available,category,badge,badge_color,stock_status,stock_note,images,image_variants,featured,sort_order,active";
export const ADMIN_PRODUCT_COLUMNS = `${PUBLIC_PRODUCT_COLUMNS},image_paths`;

export const PUBLIC_BOOTH_COLUMNS =
  "id,shop_id,booth_name,subtitle,booth_code,location,open_hours,logo_url,instagram_url,instagram_visible,facebook_url,facebook_visible,tiktok_url,tiktok_visible,x_url,x_visible,threads_url,threads_visible,youtube_url,youtube_visible,social_qr_logo_url,theme_primary,theme_secondary,theme_accent,theme_background,layout_order,corner_radius,card_style,featured_style,controls_style,product_style,catalog_locale,featured_autoplay";
export const ADMIN_BOOTH_COLUMNS = `${PUBLIC_BOOTH_COLUMNS},logo_path,social_qr_logo_path`;

export const PUBLIC_PAYMENT_COLUMNS =
  "id,shop_id,momo_qr_url,bank_qr_url,momo_label,bank_label,bank_code,bank_acq_id,bank_account_no,bank_account_name,bank_add_info_template,payment_instructions";
export const ADMIN_PAYMENT_COLUMNS = PUBLIC_PAYMENT_COLUMNS;
