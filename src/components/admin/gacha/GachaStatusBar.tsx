import { Eye, Gamepad2, Layers3, Rocket, X } from "lucide-react";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";
import type { GachaGameType, GachaLiveStatus } from "../../../types/gacha";
import { Button } from "../../ui/Button";
import { AdminEditBar } from "../AdminEditBar";

export type GachaStatusGame = {
  gameType: GachaGameType;
  /** Brand label from the game descriptor; intentionally not translated. */
  label: string;
  dirty: boolean;
  isLive: boolean;
};

type Props = {
  games: GachaStatusGame[];
  activeGame: GachaGameType;
  /** Live status when the published game is the one being edited. */
  currentLive: GachaLiveStatus | null;
  /** Whether any game has ever been published. */
  hasPublished: boolean;
  onSwitchGame: (gameType: GachaGameType) => void;
  onPreview: () => void;
};

type EditBarProps = {
  dirty: boolean;
  saving: boolean;
  publishing: boolean;
  onReset: () => void;
  onPublish: () => void;
};

export function GachaStatusBar({
  games,
  activeGame,
  currentLive,
  hasPublished,
  onSwitchGame,
  onPreview,
}: Props) {
  const { t } = usePlatformI18n();

  return (
    <header className="gacha-status-bar">
      <div
        className="gacha-status-games"
        role="group"
        aria-label={t("Game editor")}
      >
        {games.map((game) => {
          const isActive = game.gameType === activeGame;
          return (
            <button
              type="button"
              key={game.gameType}
              className={isActive ? "active" : ""}
              aria-pressed={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSwitchGame(game.gameType)}
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
                    "button",
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
              <strong>{game.label}</strong>
              {(game.isLive || game.dirty) && (
                <i
                  className={game.dirty ? "is-dirty" : "is-live"}
                  aria-label={t(game.dirty ? "Unsaved" : "Live now")}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="gacha-status-summary">
        <div className="gacha-status-chips" aria-label={t("Gacha status")}>
          {currentLive ? (
            <>
              <span
                className={`gacha-chip ${currentLive.settings.enabled ? "is-open" : "is-closed"}`}
              >
                <i aria-hidden="true" />
                {t(currentLive.settings.enabled ? "Open" : "Closed")}
              </span>
              <span className="gacha-chip">
                <Layers3 size={13} aria-hidden="true" />
                {t("{{banners}} banners · {{items}} items", {
                  banners: currentLive.bannerCount,
                  items: currentLive.entryCount,
                })}
              </span>
            </>
          ) : (
            <span className="gacha-chip">
              <Gamepad2 size={13} aria-hidden="true" />
              {t(hasPublished ? "Not live" : "Not published yet")}
            </span>
          )}
        </div>
        <button
          type="button"
          className="button button-secondary gacha-preview-button"
          onClick={onPreview}
        >
          <Eye size={16} /> <span>{t("Preview")}</span>
        </button>
      </div>
    </header>
  );
}

export function GachaEditBar({
  dirty,
  saving,
  publishing,
  onReset,
  onPublish,
}: EditBarProps) {
  const { t } = usePlatformI18n();
  const busy = saving || publishing;

  return (
    <AdminEditBar
      className="gacha-sticky-actions"
      status={t(
        saving ? "Saving draft…" : dirty ? "Unsaved changes" : "Draft saved",
      )}
      statusTone={saving ? "saving" : dirty ? "dirty" : "saved"}
    >
      <Button
        type="button"
        variant="secondary"
        className="gacha-reset-button admin-edit-secondary-danger"
        icon={<X size={17} />}
        disabled={!dirty || busy}
        onClick={onReset}
        title={t("Discard changes")}
        aria-label={t("Discard changes")}
      >
        {t("Discard changes")}
      </Button>
      <Button
        className="gacha-publish-button"
        icon={<Rocket size={16} />}
        loading={publishing}
        loadingText={t("Publishing…")}
        disabled={busy}
        onClick={onPublish}
      >
        {t("Publish")}
      </Button>
    </AdminEditBar>
  );
}
