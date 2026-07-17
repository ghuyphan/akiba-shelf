import type { CSSProperties } from "react";
import { getGachaElementMeta } from "../../../lib/gachaGames";
import type { GachaGameType } from "../../../types/gacha";

export function GachaElementIcon({
  gameType,
  element,
  size = 16,
  className = "",
}: {
  gameType: GachaGameType;
  element: string;
  size?: number;
  className?: string;
}) {
  const meta = getGachaElementMeta(gameType, element);
  if (!meta) return null;

  if (meta.visual.type === "image") {
    return (
      <img
        src={meta.visual.src}
        alt=""
        width={size}
        height={size}
        className={`gacha-element-icon is-hsr ${className}`.trim()}
      />
    );
  }

  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={`gacha-element-icon is-genshin ${className}`.trim()}
      style={{ "--gacha-element-color": meta.color } as CSSProperties}
      fill="currentColor"
      aria-hidden="true"
    >
      <g transform="translate(0, 480) scale(1, -1)">
        <path d={meta.visual.d} />
      </g>
    </svg>
  );
}
