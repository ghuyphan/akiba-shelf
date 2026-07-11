import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "./Button";

type ModalProps = {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  className?: string;
  mobileSheet?: boolean;
};

let openModalsCount = 0;

function lockScroll() {
  if (openModalsCount === 0) {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.paddingRight = `${scrollbarWidth}px`;
    document.body.style.overflow = "hidden";
  }
  openModalsCount++;
}

function unlockScroll() {
  openModalsCount = Math.max(0, openModalsCount - 1);
  if (openModalsCount === 0) {
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
  }
}

export function Modal({ title, isOpen, onClose, children, wide = false, className = "", mobileSheet = false }: ModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);

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

    lockScroll();

    return () => {
      unlockScroll();
    };
  }, [shouldRender]);

  if (!shouldRender) return null;

  const modal = (
    <div className={`modal-backdrop ${mobileSheet ? "mobile-sheet-backdrop" : ""} ${isOpen ? "is-open" : "is-closing"}`} role="presentation" onClick={onClose}>
      <section
        className={`modal ${mobileSheet ? "mobile-sheet-modal" : ""} ${isOpen ? "is-open" : "is-closing"} ${wide ? "modal-wide" : ""} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        {mobileSheet && <div className="mobile-sheet-handle" aria-hidden="true"><span /></div>}
        <header className="modal-header">
          <h2>{title}</h2>
          <Button variant="ghost" icon={<X size={22} />} aria-label="Close modal" onClick={onClose} />
        </header>
        {children}
      </section>
    </div>
  );

  return createPortal(modal, document.body);
}
