import { MAX_FEATURED_PRODUCTS } from "../constants";
import { PUBLIC_PRODUCT_COLUMNS } from "../catalogQueries";
import type { PublicProductSort } from "../catalogQueries";
import { productRowSchema } from "../schemas";
import type { Product } from "../../types/catalog";
import { requireSupabase, textArray } from "./shared";
import type { ApiClient } from "./shared";
import { removeUnreferencedProductImages } from "./storage";
import { normalizeProduct } from "./productNormalization";

export { normalizeProduct } from "./productNormalization";

export type { PublicProductSort } from "../catalogQueries";

export type PublicProductPage = { products: Product[]; hasMore: boolean };

type PublicProductQuery = {
  offset?: number;
  pageSize?: number;
  category?: string;
  search?: string;
  sort?: PublicProductSort;
  signal?: AbortSignal;
};

function safeCatalogSearch(value: string) {
  return value
    .trim()
    .replace(/[\\"(),.%_*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getPublicProducts(
  shopId: string,
  {
    offset = 0,
    pageSize = 24,
    category,
    search = "",
    sort = "recommended",
    signal,
  }: PublicProductQuery = {},
): Promise<PublicProductPage> {
  let query = requireSupabase()
    .from("products")
    .select(PUBLIC_PRODUCT_COLUMNS)
    .eq("shop_id", shopId)
    .eq("active", true);
  if (category && category !== "All") query = query.eq("category", category);
  const searchTerm = safeCatalogSearch(search);
  if (searchTerm) {
    const pattern = `*${searchTerm}*`;
    query = query.or(
      `name.ilike.${pattern},item_code.ilike.${pattern},collection.ilike.${pattern},description.ilike.${pattern}`,
    );
  }
  if (sort === "price-asc") {
    query = query.order("effective_price_vnd", { ascending: true });
  } else if (sort === "price-desc") {
    query = query.order("effective_price_vnd", { ascending: false });
  } else if (sort === "quantity") {
    query = query.order("quantity_available", { ascending: false });
  } else if (sort === "name") {
    query = query.order("name", { ascending: true });
  } else {
    query = query
      .order("featured", { ascending: false })
      .order("sort_order", { ascending: true });
  }
  const safeOffset = Math.max(0, offset);
  const safePageSize = Math.max(1, Math.min(pageSize, 100));
  const rangedQuery = query
    .order("id", { ascending: true })
    .range(safeOffset, safeOffset + safePageSize);
  const { data, error } = await (signal
    ? rangedQuery.abortSignal(signal)
    : rangedQuery);
  if (error) throw error;
  const rows = ((data ?? []) as unknown[]).map((row) =>
    normalizeProduct(productRowSchema.parse(row)),
  );
  return {
    products: rows.slice(0, safePageSize),
    hasMore: rows.length > safePageSize,
  };
}

export async function getPublicFeaturedProducts(
  shopId: string,
  limit = MAX_FEATURED_PRODUCTS,
): Promise<Product[]> {
  const { data, error } = await requireSupabase()
    .from("products")
    .select(PUBLIC_PRODUCT_COLUMNS)
    .eq("shop_id", shopId)
    .eq("active", true)
    .eq("featured", true)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown[]).map((row) =>
    normalizeProduct(productRowSchema.parse(row)),
  );
}

export async function getPublicProductCategories(
  shopId: string,
): Promise<string[]> {
  const { data, error } = await requireSupabase().rpc(
    "get_public_product_categories",
    { p_shop_id: shopId },
  );
  if (error) throw error;
  return ((data ?? []) as { category: string }[]).map((row) => row.category);
}

export async function getPublicProductsByIds(
  shopId: string,
  productIds: string[],
): Promise<Product[]> {
  if (productIds.length === 0) return [];
  const { data, error } = await requireSupabase()
    .from("products")
    .select(PUBLIC_PRODUCT_COLUMNS)
    .eq("shop_id", shopId)
    .eq("active", true)
    .in("id", [...new Set(productIds)]);
  if (error) throw error;
  return ((data ?? []) as unknown[]).map((row) =>
    normalizeProduct(productRowSchema.parse(row)),
  );
}

export async function getAdminProducts(shopId: string): Promise<Product[]> {
  const { data, error } = await requireSupabase().rpc("get_admin_products", {
    p_shop_id: shopId,
  });
  if (error) throw error;
  return ((data ?? []) as unknown[]).map((row) =>
    normalizeProduct(productRowSchema.parse(row)),
  );
}

async function getProductImagePaths(
  client: ApiClient,
  shopId: string,
  productId: string,
): Promise<string[] | null> {
  const { data, error } = await client
    .rpc("get_admin_products", { p_shop_id: shopId })
    .select("image_paths")
    .eq("id", productId)
    .maybeSingle();
  if (error) throw error;
  return data
    ? textArray((data as { image_paths?: unknown }).image_paths)
    : null;
}

export async function saveProduct(
  shopId: string,
  product: Product,
): Promise<Product> {
  const client = requireSupabase();
  const previousPaths = await getProductImagePaths(client, shopId, product.id);
  const editableProduct = { ...product };
  delete editableProduct.effective_price_vnd;
  const payload = { ...editableProduct, shop_id: shopId };
  // Private image paths make update/insert safer than a grant-expanding upsert.
  const write = previousPaths
    ? client
        .from("products")
        .update(payload)
        .eq("id", product.id)
        .eq("shop_id", shopId)
    : client.from("products").insert(payload);
  const { data, error } = await write.select(PUBLIC_PRODUCT_COLUMNS).single();
  if (error) throw error;
  const removedPaths = (previousPaths ?? []).filter(
    (path) => !textArray(product.image_paths).includes(path),
  );
  if (removedPaths.length) {
    await removeUnreferencedProductImages(client, shopId, removedPaths);
  }
  return normalizeProduct(
    productRowSchema.parse({ ...data, image_paths: product.image_paths }),
  );
}

export async function deleteProduct(shopId: string, id: string) {
  const client = requireSupabase();
  const paths = await getProductImagePaths(client, shopId, id);
  if (!paths) throw new Error("Product not found.");
  const { error } = await client
    .from("products")
    .delete()
    .eq("shop_id", shopId)
    .eq("id", id);
  if (error) throw error;
  if (paths.length) {
    await removeUnreferencedProductImages(client, shopId, paths);
  }
}
