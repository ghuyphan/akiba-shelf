import { useEffect, useMemo, useState } from "react";
import type { PromotionSettings } from "../../types/catalog";
import { isPromotionActive } from "../../utils/pricing";

export function useScheduledPromotion(configured: PromotionSettings) {
  const [clock, setClock] = useState(Date.now);
  const startsAt = configured.starts_at;
  const endsAt = configured.ends_at;
  const isEnabled = isPromotionActive(configured, new Date(clock));
  const rewardIdsKey = configured.reward_product_ids?.join("\u0000") ?? "";
  const qualifyingIdsKey = configured.qualifying_product_ids?.join("\u0000") ?? "";

  const promotion = useMemo<PromotionSettings>(
    () => ({
      ...configured,
      enabled: isEnabled,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      configured.shop_id,
      configured.kind,
      configured.starts_at,
      configured.ends_at,
      configured.buy_quantity,
      configured.free_quantity,
      configured.repeatable,
      configured.percentage_off,
      configured.minimum_subtotal_vnd,
      rewardIdsKey,
      qualifyingIdsKey,
      isEnabled,
    ],
  );

  useEffect(() => {
    const now = Date.now();
    const nextBoundary = [startsAt, endsAt]
      .map((value) => (value ? Date.parse(value) : Number.NaN))
      .filter((value) => Number.isFinite(value) && value > now)
      .sort((first, second) => first - second)[0];
    if (nextBoundary === undefined) return;

    const timer = window.setTimeout(
      () => setClock(Date.now()),
      Math.min(nextBoundary - now + 25, 2_147_483_647),
    );
    return () => window.clearTimeout(timer);
  }, [clock, endsAt, startsAt]);

  return promotion;
}
