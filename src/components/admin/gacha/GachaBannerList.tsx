import {
  ArrowDown,
  ArrowUp,
  Copy,
  Ellipsis,
  Plus,
  Sword,
  Trash2,
  UserRound,
} from "lucide-react";
import { useMemo } from "react";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";
import type { GachaBanner, GachaPoolEntry } from "../../../types/gacha";

type Props = {
  banners: GachaBanner[];
  entries: GachaPoolEntry[];
  selectedBannerId: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDelete: boolean;
  onSelect: (bannerId: string) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (delta: number) => void;
};

export function GachaBannerList({
  banners,
  entries,
  selectedBannerId,
  canMoveUp,
  canMoveDown,
  canDelete,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onMove,
}: Props) {
  const { t } = usePlatformI18n();
  const activeEntryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      if (!entry.active) continue;
      counts.set(entry.banner_id, (counts.get(entry.banner_id) ?? 0) + 1);
    }
    return counts;
  }, [entries]);

  return (
    <>
      <div className="gacha-banner-strip" aria-label={t("Banners")}>
        {banners.map((banner, index) => {
          const isSelected = banner.id === selectedBannerId;
          return (
            <button
              type="button"
              key={banner.id}
              className={`gacha-banner-card ${isSelected ? "active" : ""}`}
              aria-pressed={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onSelect(banner.id)}
              onKeyDown={(event) => {
                if (
                  !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                    event.key,
                  )
                ) {
                  return;
                }
                event.preventDefault();
                const buttons = Array.from(
                  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                    ".gacha-banner-card",
                  ) ?? [],
                );
                const currentIndex = buttons.indexOf(event.currentTarget);
                const nextIndex =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? buttons.length - 1
                      : (currentIndex +
                          (event.key === "ArrowLeft" ? -1 : 1) +
                          buttons.length) %
                        buttons.length;
                buttons[nextIndex]?.focus();
                buttons[nextIndex]?.click();
              }}
            >
              <span className={`gacha-banner-kind ${banner.kind}`}>
                {banner.kind !== "character" ? (
                  <Sword size={16} />
                ) : (
                  <UserRound size={16} />
                )}
              </span>
              <span className="gacha-banner-card-copy">
                <small>{t("Banner {{number}}", { number: index + 1 })}</small>
                <strong>{banner.name}</strong>
                <small>
                  {activeEntryCounts.get(banner.id) ?? 0} {t("items")} ·{" "}
                  {banner.display_limit} {t("shown")}
                </small>
              </span>
              <i
                className={banner.active ? "is-live" : ""}
                title={t(banner.active ? "Banner active" : "Banner inactive")}
              />
            </button>
          );
        })}
      </div>
      <div className="gacha-banner-actions">
        <button
          type="button"
          className="button button-secondary gacha-add-banner"
          onClick={onAdd}
        >
          <Plus size={16} /> {t("Add banner")}
        </button>
        <details className="gacha-banner-menu">
          <summary className="icon-button" aria-label={t("Banner actions")}>
            <Ellipsis size={18} />
          </summary>
          <div className="gacha-banner-menu-popover">
            <button
              type="button"
              onClick={() => onMove(-1)}
              disabled={!canMoveUp}
            >
              <ArrowUp size={16} /> {t("Move earlier")}
            </button>
            <button
              type="button"
              onClick={() => onMove(1)}
              disabled={!canMoveDown}
            >
              <ArrowDown size={16} /> {t("Move later")}
            </button>
            <button type="button" onClick={onDuplicate}>
              <Copy size={16} /> {t("Duplicate banner")}
            </button>
            <button
              type="button"
              className="danger"
              onClick={onDelete}
              disabled={!canDelete}
              title={!canDelete ? t("Keep at least one banner.") : undefined}
            >
              <Trash2 size={16} /> {t("Delete banner")}
            </button>
          </div>
        </details>
      </div>
    </>
  );
}
