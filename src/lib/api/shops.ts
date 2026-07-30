import { defaultBooth } from "../constants";
import type { BoothSettings, Shop, ShopMembership } from "../../types/catalog";
import { requireSupabase } from "./shared";
import {
  shopMembershipListSchema,
  shopSchema,
  shopWorkspaceSummarySchema,
} from "../schemas";

export async function getPublicShop(slug: string): Promise<Shop | null> {
  const { data, error } = await requireSupabase()
    .from("shops")
    .select("id,name,slug,active,accepting_orders,catalog_source_shop_id")
    .eq("slug", slug.toLowerCase())
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  return data ? shopSchema.parse(data) : null;
}

export async function getShopMemberships(): Promise<ShopMembership[]> {
  const { data, error } = await requireSupabase().rpc(
    "get_my_shop_memberships",
  );
  if (error) throw error;
  return shopMembershipListSchema.parse(data ?? []) as ShopMembership[];
}

export async function getShopWorkspaceSummary(
  shopId: string,
): Promise<
  Pick<Shop, "id" | "name" | "slug"> &
    Pick<BoothSettings, "booth_name" | "logo_url" | "theme_background">
> {
  const { data, error } = await requireSupabase()
    .rpc("get_shop_workspace_summary", { p_shop_id: shopId })
    .single();
  if (error) throw error;
  const summary = shopWorkspaceSummarySchema.parse(data);
  return {
    id: summary.shop_id,
    name: summary.shop_name,
    slug: summary.shop_slug,
    booth_name: summary.booth_name ?? summary.shop_name,
    logo_url: summary.logo_url ?? "",
    theme_background: summary.theme_background ?? defaultBooth.theme_background,
  };
}

export async function createShop(name: string, slug: string): Promise<Shop> {
  const { data, error } = await requireSupabase().rpc("create_shop", {
    p_name: name,
    p_slug: slug,
  });
  if (error) throw error;
  return shopSchema.parse(data);
}

export async function updateShop(shopId: string, name: string): Promise<void> {
  const { error } = await requireSupabase().rpc("update_shop_details", {
    p_shop_id: shopId,
    p_name: name.trim(),
  });
  if (error) throw error;
}
