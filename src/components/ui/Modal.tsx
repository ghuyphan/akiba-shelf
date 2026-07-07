import type { ReactNode } from "react";
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
};

export function Modal({ title, isOpen, onClose, children, wide = false, className = "" }: ModalProps) {
  if (!isOpen) return null;

  const modal = (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className={`modal ${wide ? "modal-wide" : ""} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
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
