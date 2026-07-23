import { requireSupabase } from "./shared";

export async function getPublicGachaEnabled(shopId: string): Promise<boolean> {
  const { data, error } = await requireSupabase()
    .from("gacha_published_configs")
    .select("game_type")
    .eq("shop_id", shopId)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}
