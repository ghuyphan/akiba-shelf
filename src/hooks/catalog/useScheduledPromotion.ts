import { useEffect, useMemo, useState } from "react";
import type { PromotionSettings } from "../../types/catalog";
import { isPromotionActive } from "../../utils/pricing";

export function useScheduledPromotion(configured: PromotionSettings) {
  const [clock, setClock] = useState(Date.now);
  const startsAt = configured.starts_at;
  const endsAt = configured.ends_at;
  const promotion = useMemo(
    () => ({
      ...configured,
      enabled: isPromotionActive(configured, new Date(clock)),
    }),
    [clock, configured],
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
