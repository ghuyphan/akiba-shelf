import {
  Eye,
  Gamepad2,
  Layers3,
  Redo2,
  Rocket,
  Save,
  Undo2,
  X,
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
  onSwitchGame: (gameType: GachaGameType) => void;
  onPreview: () => void;
};

type EditBarProps = {
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  saving: boolean;
  publishing: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onSaveDraft: () => void;
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
  canUndo,
  canRedo,
  saving,
  publishing,
  onUndo,
  onRedo,
  onReset,
  onSaveDraft,
  onPublish,
}: EditBarProps) {
  const { t } = usePlatformI18n();
  const busy = saving || publishing;

  return (
    <div className="admin-sticky-actions gacha-sticky-actions">
      {dirty && (
        <span className="admin-unsaved-badge">{t("Unsaved changes")}</span>
      )}
      <button
        type="button"
        className="icon-button gacha-undo-button"
        disabled={!canUndo || busy}
        onClick={onUndo}
        title={t("Undo")}
        aria-label={t("Undo")}
      >
        <Undo2 size={16} />
      </button>
      <button
        type="button"
        className="icon-button gacha-redo-button"
        disabled={!canRedo || busy}
        onClick={onRedo}
        title={t("Redo")}
        aria-label={t("Redo")}
      >
        <Redo2 size={16} />
      </button>
      <button
        type="button"
        className="button button-secondary gacha-reset-button"
        disabled={!dirty || busy}
        onClick={onReset}
        title={t("Reset changes")}
        aria-label={t("Reset changes")}
      >
        <X size={17} /> <span>{t("Reset changes")}</span>
      </button>
      <Button
        className="gacha-save-button"
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
        className="gacha-publish-button"
        icon={<Rocket size={16} />}
        loading={publishing}
        loadingText={t("Publishing…")}
        disabled={busy}
        onClick={onPublish}
      >
        {t("Publish")}
      </Button>
    </div>
  );
}
