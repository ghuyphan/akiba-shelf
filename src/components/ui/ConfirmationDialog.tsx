import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";
import { Modal } from "./Modal";

type ConfirmationDialogProps = {
  isOpen: boolean;
  title: string;
  message: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  loadingLabel?: string;
  busy?: boolean;
  danger?: boolean;
  mobileSheet?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmationDialog({
  isOpen,
  title,
  message,
  cancelLabel,
  confirmLabel,
  loadingLabel,
  busy = false,
  danger = true,
  mobileSheet = true,
  onClose,
  onConfirm,
}: ConfirmationDialogProps) {
  return (
    <Modal
      title={title}
      isOpen={isOpen}
      onClose={onClose}
      appearance="admin"
      dismissible={!busy}
      mobileSheet={mobileSheet}
      className="confirmation-modal"
      closeLabel={cancelLabel}
    >
      <div className="confirmation-dialog">
        <span className="confirmation-dialog-icon" aria-hidden="true">
          <AlertTriangle size={22} />
        </span>
        <div className="confirmation-dialog-message">{message}</div>
        <div className="confirmation-dialog-actions">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            loading={busy}
            loadingText={loadingLabel}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
