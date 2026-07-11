import { ReactNode, RefObject, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type MobileSheetShellProps = {
  children: ReactNode;
  open: boolean;
  onDismiss: () => void;
  mode: "modal" | "expandable";
  className?: string;
  backdropClassName?: string;
  containerRef?: RefObject<HTMLElement | null>;
  role?: "dialog";
  ariaModal?: boolean;
  ariaLabel?: string;
  tabIndex?: number;
  portalBackdrop?: boolean;
};

let scrollLocks = 0;

function lockBodyScroll() {
  if (scrollLocks === 0) {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.paddingRight = `${scrollbarWidth}px`;
    document.body.style.overflow = "hidden";
  }
  scrollLocks += 1;
}

function unlockBodyScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) {
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
  }
}

function useSheetScrollLock(active: boolean, mobileOnly: boolean) {
  useEffect(() => {
    if (!active) return;
    const media = window.matchMedia("(max-width: 760px)");
    if (mobileOnly && !media.matches) return;
    lockBodyScroll();
    return unlockBodyScroll;
  }, [active, mobileOnly]);
}

export function SheetHandle({ onClick, label }: { onClick?: () => void; label?: string }) {
  return (
    <div
      className="mobile-sheet-handle"
      aria-hidden={onClick ? undefined : "true"}
      aria-label={onClick ? label : undefined}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      } : undefined}
    >
      <span />
    </div>
  );
}

export function MobileSheetShell({
  children,
  open,
  onDismiss,
  mode,
  className = "",
  backdropClassName = "",
  containerRef,
  role,
  ariaModal,
  ariaLabel,
  tabIndex,
  portalBackdrop = false,
}: MobileSheetShellProps) {
  const [backdropMounted, setBackdropMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setBackdropMounted(true);
      return;
    }
    const timer = window.setTimeout(() => setBackdropMounted(false), 240);
    return () => window.clearTimeout(timer);
  }, [open]);

  useSheetScrollLock(mode === "modal" || open, mode === "expandable");

  useEffect(() => {
    if (mode !== "expandable" || !open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onDismiss();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [mode, onDismiss, open]);

  const surface = (
    <section
        ref={containerRef}
        className={`sheet-surface sheet-${mode} ${open ? "is-open" : "is-closing"} ${className}`}
        role={role}
        aria-modal={ariaModal}
        aria-label={ariaLabel}
        tabIndex={tabIndex}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </section>
  );

  if (mode === "modal") {
    return backdropMounted ? (
      <div
        className={`sheet-backdrop ${backdropClassName} ${open ? "is-open" : "is-closing"}`}
        role="presentation"
        onClick={onDismiss}
      >
        {surface}
      </div>
    ) : null;
  }

  const backdropElement = backdropMounted ? (
    <div
      className={`sheet-backdrop ${backdropClassName} ${open ? "is-open" : "is-closing"}`}
      role="presentation"
      onClick={onDismiss}
    />
  ) : null;
  const backdrop = portalBackdrop && backdropElement
    ? createPortal(backdropElement, document.body)
    : backdropElement;

  return (
    <>
      {backdrop}
      {surface}
    </>
  );
}
