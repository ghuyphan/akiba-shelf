import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "./Button";
import { MobileSheetShell, SheetHandle } from "./MobileSheetShell";

type ModalProps = {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  className?: string;
  mobileSheet?: boolean;
};

export function Modal({ title, isOpen, onClose, children, wide = false, className = "", mobileSheet = false }: ModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    } else if (shouldRender) {
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 220);
      return () => clearTimeout(timer);
    }
  }, [isOpen, shouldRender]);

  useEffect(() => {
    if (!shouldRender) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
    window.requestAnimationFrame(() => (focusable()[0] ?? dialog)?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
      if (dialogs[dialogs.length - 1] !== dialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        dialog?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [shouldRender]);

  if (!shouldRender) return null;

  const modal = (
    <MobileSheetShell
      open={isOpen}
      onDismiss={onClose}
      mode="modal"
      containerRef={dialogRef}
      className={`modal ${mobileSheet ? "mobile-sheet-modal" : ""} ${wide ? "modal-wide" : ""} ${className}`}
      backdropClassName={`modal-backdrop ${mobileSheet ? "mobile-sheet-backdrop" : ""}`}
      role="dialog"
      ariaModal
      ariaLabel={title}
      tabIndex={-1}
    >
        {mobileSheet && <SheetHandle />}
        <header className="modal-header">
          <h2>{title}</h2>
          <Button variant="ghost" icon={<X size={22} />} aria-label="Close modal" onClick={onClose} />
        </header>
        {children}
    </MobileSheetShell>
  );

  return createPortal(modal, document.body);
}
