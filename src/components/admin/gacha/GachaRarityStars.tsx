import type { GachaGameType } from "../../../types/gacha";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";

type Props = {
  gameType: GachaGameType;
  rarity: number;
};

export function GachaRarityStars({ gameType, rarity }: Props) {
  const { t } = usePlatformI18n();
  const count = Math.max(1, Math.min(5, rarity));

  return (
    <span
      className={`gacha-rarity-stars gacha-rarity-stars-${gameType}`}
      role="img"
      aria-label={t("{{count}}-star rarity", { count: rarity })}
    >
      {Array.from({ length: count }, (_, index) => (
        <i key={index} className="gacha-rarity-star" aria-hidden="true" />
      ))}
    </span>
  );
}
