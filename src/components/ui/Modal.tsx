import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "./Button";
import {
  MobileSheetShell,
  SHEET_EXIT_DURATION_MS,
  SheetHandle,
} from "./MobileSheetShell";
import { useOverlayHistory } from "../../hooks/shared/useOverlayHistory";

type ModalProps = {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  className?: string;
  mobileSheet?: boolean;
  appearance?: "default" | "admin";
  dismissible?: boolean;
  historyEnabled?: boolean;
  /** Accessible label for the close button. Localized callers should pass
   * their own string; staff screens keep the English default. */
  closeLabel?: string;
};

export function Modal({
  title,
  isOpen,
  onClose,
  children,
  wide = false,
  className = "",
  mobileSheet = false,
  appearance = "default",
  dismissible = true,
  historyEnabled = true,
  closeLabel = "Close modal",
}: ModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const requestClose = useOverlayHistory(
    isOpen,
    onClose,
    mobileSheet && historyEnabled,
    dismissible,
  );

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    } else if (shouldRender) {
      const timer = setTimeout(
        () => setShouldRender(false),
        mobileSheet ? SHEET_EXIT_DURATION_MS : 220,
      );
      return () => clearTimeout(timer);
    }
  }, [isOpen, mobileSheet, shouldRender]);

  if (!shouldRender) return null;

  const modal = (
    <MobileSheetShell
      open={isOpen}
      onDismiss={requestClose}
      mode="modal"
      className={`modal ${appearance === "admin" ? "modal-admin" : ""} ${mobileSheet ? "mobile-sheet-modal" : ""} ${wide ? "modal-wide" : ""} ${className}`}
      backdropClassName={`modal-backdrop ${mobileSheet ? "mobile-sheet-backdrop" : ""}`}
      role="dialog"
      ariaModal
      ariaLabel={title}
      tabIndex={-1}
      dragDismissible={dismissible}
    >
      {mobileSheet && <SheetHandle />}
      <header
        className="modal-header"
        data-sheet-drag-region={mobileSheet || undefined}
      >
        <h2>{title}</h2>
        <Button
          variant="ghost"
          icon={<X size={22} />}
          aria-label={closeLabel}
          disabled={!dismissible}
          onClick={requestClose}
        />
      </header>
      {children}
    </MobileSheetShell>
  );

  return createPortal(modal, document.body);
}
