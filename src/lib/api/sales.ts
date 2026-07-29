import { salesSummarySchema } from "../schemas";
import type { SalesSummary } from "../../types/catalog";
import { requireSupabase } from "./shared";

export async function getSalesSummary(
  shopId: string,
  from: string,
  to: string,
): Promise<SalesSummary> {
  const { data, error } = await requireSupabase().rpc("get_sales_summary", {
    p_shop_id: shopId,
    p_from: from,
    p_to: to,
  });
  if (error) throw error;
  return salesSummarySchema.parse(data) as SalesSummary;
}
