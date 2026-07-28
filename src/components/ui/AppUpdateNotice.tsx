import { RefreshCw, X } from "lucide-react";
import { useAppUpdate } from "../../hooks/shared/useAppUpdate";
import { ToastStackPortal } from "./ToastProvider";

export type AppUpdateNoticeCopy = {
  ariaLabel: string;
  title: string;
  message: string;
  updateLabel: string;
  updatingLabel: string;
  laterLabel: string;
  dismissLabel: string;
};

export function AppUpdateNotice({ copy }: { copy: AppUpdateNoticeCopy }) {
  const { applyUpdate, dismiss, isUpdateAvailable, isUpdating } =
    useAppUpdate();

  if (!isUpdateAvailable) return null;

  const notice = (
    <aside
      className="app-update-notice"
      aria-label={copy.ariaLabel}
      role="status"
    >
      <span className="app-update-notice-icon" aria-hidden="true">
        <RefreshCw size={17} />
      </span>
      <div className="app-update-notice-copy">
        <strong>{copy.title}</strong>
        <span>{copy.message}</span>
      </div>
      <div className="app-update-notice-actions">
        <button
          type="button"
          className="app-update-notice-update"
          disabled={isUpdating}
          onClick={() => void applyUpdate()}
        >
          <RefreshCw size={15} aria-hidden="true" />
          <span>{isUpdating ? copy.updatingLabel : copy.updateLabel}</span>
        </button>
        <button
          type="button"
          className="app-update-notice-later"
          onClick={dismiss}
          disabled={isUpdating}
        >
          {copy.laterLabel}
        </button>
      </div>
      <button
        type="button"
        className="app-update-notice-dismiss"
        aria-label={copy.dismissLabel}
        onClick={dismiss}
        disabled={isUpdating}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </aside>
  );

  return <ToastStackPortal>{notice}</ToastStackPortal>;
}
