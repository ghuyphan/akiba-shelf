import type { ReactNode } from "react";
import { ModalFooter } from "../../ui/Modal";

type AdminEditStatusTone = "saved" | "dirty" | "saving" | "neutral";

type AdminEditBarProps = {
  status: ReactNode;
  statusTone?: AdminEditStatusTone;
  className?: string;
  modalFooter?: boolean;
  children: ReactNode;
};

export function AdminEditBar({
  status,
  statusTone = "neutral",
  className = "",
  modalFooter = false,
  children,
}: AdminEditBarProps) {
  const content = (
    <>
      <span className={`admin-edit-status is-${statusTone}`} aria-live="polite">
        <i aria-hidden="true" />
        {status}
      </span>
      <div className="admin-edit-actions">{children}</div>
    </>
  );
  const footerClassName = `admin-sticky-actions admin-edit-bar ${className}`;

  if (modalFooter) {
    return <ModalFooter className={footerClassName}>{content}</ModalFooter>;
  }

  return (
    <footer className={footerClassName}>
      {content}
    </footer>
  );
}
