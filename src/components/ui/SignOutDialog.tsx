import { LogOut } from "lucide-react";
import { Button } from "./Button";
import { Modal } from "./Modal";

type SignOutDialogProps = {
  isOpen: boolean;
  busy: boolean;
  title: string;
  heading: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  loadingLabel: string;
  onClose: () => void;
  onConfirm: () => void;
};

export function SignOutDialog({
  isOpen,
  busy,
  title,
  heading,
  message,
  cancelLabel,
  confirmLabel,
  loadingLabel,
  onClose,
  onConfirm,
}: SignOutDialogProps) {
  return (
    <Modal
      title={title}
      isOpen={isOpen}
      onClose={() => {
        if (!busy) onClose();
      }}
      className="signout-modal"
      appearance="admin"
      dismissible={!busy}
      closeLabel={cancelLabel}
    >
      <div className="signout-confirmation">
        <span className="signout-confirmation-icon">
          <LogOut size={22} />
        </span>
        <div>
          <h3>{heading}</h3>
          <p>{message}</p>
        </div>
        <div className="signout-confirmation-actions">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button loading={busy} loadingText={loadingLabel} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
