import {
  Eye,
  Gamepad2,
  Layers3,
  Redo2,
  Rocket,
  RotateCcw,
  Save,
  Undo2,
} from "lucide-react";
import { usePlatformI18n } from "../../../lib/platformI18n";
import type { GachaGameType, GachaLiveStatus } from "../../../types/gacha";
import { Button } from "../../ui/Button";

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
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  saving: boolean;
  publishing: boolean;
  onSwitchGame: (gameType: GachaGameType) => void;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onPreview: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
};

export function GachaStatusBar({
  games,
  activeGame,
  currentLive,
  hasPublished,
  dirty,
  canUndo,
  canRedo,
  saving,
  publishing,
  onSwitchGame,
  onUndo,
  onRedo,
  onReset,
  onPreview,
  onSaveDraft,
  onPublish,
}: Props) {
  const { t } = usePlatformI18n();
  const busy = saving || publishing;

  return (
    <header className="gacha-status-bar">
      <div
        className="gacha-status-games"
        role="group"
        aria-label={t("Game editor")}
      >
        {games.map((game) => {
          const statusLine =
            [
              game.isLive ? t("Live now") : "",
              game.dirty ? t("Unsaved") : "",
            ]
              .filter(Boolean)
              .join(" · ") || t("Draft");
          return (
            <button
              type="button"
              key={game.gameType}
              className={game.gameType === activeGame ? "active" : ""}
              aria-pressed={game.gameType === activeGame}
              onClick={() => onSwitchGame(game.gameType)}
            >
              <strong>{game.label}</strong>
              <small>{statusLine}</small>
            </button>
          );
        })}
      </div>

      <div className="gacha-status-chips" aria-label={t("Gacha status")}>
        {currentLive ? (
          <>
            <span className="gacha-chip is-live">
              <Gamepad2 size={13} aria-hidden="true" />
              {t("Live now")}
            </span>
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
        {dirty && (
          <span className="gacha-chip is-dirty">{t("Unsaved changes")}</span>
        )}
      </div>

      <div className="gacha-status-actions">
        <button
          type="button"
          className="icon-button"
          disabled={!canUndo || busy}
          onClick={onUndo}
          title={t("Undo")}
          aria-label={t("Undo")}
        >
          <Undo2 size={16} />
        </button>
        <button
          type="button"
          className="icon-button"
          disabled={!canRedo || busy}
          onClick={onRedo}
          title={t("Redo")}
          aria-label={t("Redo")}
        >
          <Redo2 size={16} />
        </button>
        <button
          type="button"
          className="icon-button"
          disabled={!dirty || busy}
          onClick={onReset}
          title={t("Reset changes")}
          aria-label={t("Reset changes")}
        >
          <RotateCcw size={16} />
        </button>
        <button
          type="button"
          className="button button-secondary gacha-preview-button"
          onClick={onPreview}
        >
          <Eye size={16} /> <span>{t("Preview")}</span>
        </button>
        <Button
          variant="secondary"
          icon={<Save size={16} />}
          loading={saving}
          loadingText={t("Saving…")}
          disabled={!dirty || busy}
          onClick={onSaveDraft}
        >
          {t("Save draft")}
        </Button>
        <Button
          icon={<Rocket size={16} />}
          loading={publishing}
          loadingText={t("Publishing…")}
          disabled={busy}
          onClick={onPublish}
        >
          {t("Publish")}
        </Button>
      </div>
    </header>
  );
}
