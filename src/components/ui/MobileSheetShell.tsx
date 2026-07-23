import { ReactNode, RefObject, useEffect, useRef, useState } from "react";
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

export const SHEET_EXIT_DURATION_MS = 240;

const focusableSelector = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getFocusableElements(surface: HTMLElement) {
  return Array.from(
    surface.querySelectorAll<HTMLElement>(focusableSelector),
  ).filter(
    (element) =>
      !element.hasAttribute("hidden") &&
      element.getAttribute("aria-hidden") !== "true",
  );
}

function inertOutsideSurface(surface: HTMLElement) {
  const changes: Array<{
    element: HTMLElement;
    inert: boolean;
    hadAttribute: boolean;
  }> = [];
  let branch: HTMLElement | null = surface;

  while (branch?.parentElement) {
    const branchParent: HTMLElement = branch.parentElement;
    for (const sibling of Array.from(branchParent.children)) {
      if (
        sibling === branch ||
        !(sibling instanceof HTMLElement) ||
        sibling.classList.contains("sheet-backdrop")
      ) {
        continue;
      }
      changes.push({
        element: sibling,
        inert: sibling.inert,
        hadAttribute: sibling.hasAttribute("inert"),
      });
      sibling.inert = true;
      sibling.setAttribute("inert", "");
    }
    if (branchParent === document.body) break;
    branch = branchParent;
  }

  return () => {
    for (const change of changes.reverse()) {
      change.element.inert = change.inert;
      if (!change.hadAttribute) change.element.removeAttribute("inert");
    }
  };
}

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
  const surfaceRef = useRef<HTMLElement>(null);

  function setSurfaceRef(node: HTMLElement | null) {
    surfaceRef.current = node;
    if (containerRef) containerRef.current = node;
  }

  useEffect(() => {
    if (open) {
      setBackdropMounted(true);
      return;
    }
    const timer = window.setTimeout(
      () => setBackdropMounted(false),
      SHEET_EXIT_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open]);

  useSheetScrollLock(open, mode === "expandable");

  useEffect(() => {
    if (mode !== "expandable" || !open) return;
    const surface = surfaceRef.current;
    if (!surface) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const restoreInert = inertOutsideSurface(surface);
    const animationFrame = window.requestAnimationFrame(() => {
      (getFocusableElements(surface)[0] ?? surface).focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
      if (dialogs[dialogs.length - 1] !== surface) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onDismiss();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(surface);
      if (focusable.length === 0) {
        event.preventDefault();
        surface.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!surface.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener("keydown", handleKeyDown);
      restoreInert();
      previousFocus?.focus();
    };
  }, [mode, onDismiss, open]);

  const surface = (
    <section
        ref={setSurfaceRef}
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
