import { ReactNode, useEffect, useRef, useState } from "react";
import { subscribeToMediaQuery } from "../../utils/mediaQuery";
import { useMobileSheetDrag } from "../../hooks/shared/useMobileSheetDrag";

type MobileSheetShellProps = {
  children: ReactNode;
  open: boolean;
  onDismiss: () => void;
  mode: "modal" | "expandable";
  className?: string;
  backdropClassName?: string;
  role?: "dialog";
  ariaModal?: boolean;
  ariaLabel?: string;
  tabIndex?: number;
  dragDismissible?: boolean;
};

let scrollLocks = 0;
let lockedBodyStyles: { overflow: string; paddingRight: string } | null = null;

const inertLocks = new WeakMap<
  HTMLElement,
  {
    count: number;
    inert: boolean;
    hadAttribute: boolean;
    ariaHidden: string | null;
    ariaFallback: boolean;
  }
>();

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

export function inertOutsideSurface(
  surface: HTMLElement,
  exemptElement?: HTMLElement | null,
) {
  const changes: HTMLElement[] = [];
  let branch: HTMLElement | null = surface;

  while (branch?.parentElement) {
    const branchParent: HTMLElement = branch.parentElement;
    for (const sibling of Array.from(branchParent.children)) {
      if (
        sibling === branch ||
        sibling === exemptElement ||
        !(sibling instanceof HTMLElement) ||
        sibling.contains(surface)
      ) {
        continue;
      }
      const existingLock = inertLocks.get(sibling);
      if (existingLock) {
        existingLock.count += 1;
      } else {
        const supportsInert = typeof sibling.inert === "boolean";
        inertLocks.set(sibling, {
          count: 1,
          inert: supportsInert ? sibling.inert : false,
          hadAttribute: sibling.hasAttribute("inert"),
          ariaHidden: sibling.getAttribute("aria-hidden"),
          ariaFallback: !supportsInert,
        });
      }
      changes.push(sibling);
      if (!inertLocks.get(sibling)?.ariaFallback) sibling.inert = true;
      sibling.setAttribute("inert", "");
      if (inertLocks.get(sibling)?.ariaFallback)
        sibling.setAttribute("aria-hidden", "true");
    }
    if (branchParent === document.body) break;
    branch = branchParent;
  }

  return () => {
    for (const element of changes.reverse()) {
      const lock = inertLocks.get(element);
      if (!lock) continue;
      lock.count -= 1;
      if (lock.count > 0) continue;
      if (!lock.ariaFallback) element.inert = lock.inert;
      if (!lock.hadAttribute) element.removeAttribute("inert");
      if (lock.ariaFallback) {
        if (lock.ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", lock.ariaHidden);
      }
      inertLocks.delete(element);
    }
  };
}

function lockBodyScroll() {
  if (scrollLocks === 0) {
    lockedBodyStyles = {
      overflow: document.body.style.overflow,
      paddingRight: document.body.style.paddingRight,
    };
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    document.body.style.paddingRight = `${scrollbarWidth}px`;
    document.body.style.overflow = "hidden";
  }
  scrollLocks += 1;
}

function unlockBodyScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) {
    document.body.style.overflow = lockedBodyStyles?.overflow ?? "";
    document.body.style.paddingRight = lockedBodyStyles?.paddingRight ?? "";
    lockedBodyStyles = null;
  }
}

function usePhoneSheetLayout() {
  const [matches, setMatches] = useState(
    () => window.matchMedia("(max-width: 760px)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const handleChange = () => setMatches(media.matches);
    handleChange();
    return subscribeToMediaQuery(media, handleChange);
  }, []);

  return matches;
}

function useSheetScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lockBodyScroll();
    return unlockBodyScroll;
  }, [active]);
}

export function SheetHandle({
  onClick,
  label,
}: {
  onClick?: () => void;
  label?: string;
}) {
  if (onClick) {
    return (
      <button
        type="button"
        className="mobile-sheet-handle"
        data-sheet-drag-handle
        aria-label={label}
        onClick={onClick}
      >
        <span aria-hidden="true" />
      </button>
    );
  }
  return (
    <div
      className="mobile-sheet-handle"
      data-sheet-drag-handle
      aria-hidden="true"
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
  role,
  ariaModal,
  ariaLabel,
  tabIndex,
  dragDismissible = true,
}: MobileSheetShellProps) {
  const isPhoneLayout = usePhoneSheetLayout();
  const phoneSheetLayout = mode === "expandable" ? isPhoneLayout : true;
  const active = open && phoneSheetLayout;
  const [backdropMounted, setBackdropMounted] = useState(active);
  const surfaceRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (active) {
      setBackdropMounted(true);
      return;
    }
    const timer = window.setTimeout(
      () => setBackdropMounted(false),
      SHEET_EXIT_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [active]);

  useSheetScrollLock(active);

  const dragHandlers = useMobileSheetDrag({
    active,
    dismissible: dragDismissible,
    isPhoneLayout,
    mode,
    onDismiss,
    surfaceRef,
  });

  useEffect(() => {
    if (!active || !backdropMounted) return;
    const surface = surfaceRef.current;
    if (!surface) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const restoreInert = inertOutsideSurface(surface, backdropRef.current);
    const animationFrame = window.requestAnimationFrame(() => {
      if (
        document.activeElement instanceof HTMLElement &&
        surface.contains(document.activeElement)
      ) {
        return;
      }
      (getFocusableElements(surface)[0] ?? surface).focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
      if (dialogs[dialogs.length - 1] !== surface) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onDismissRef.current();
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
  }, [active, backdropMounted]);

  const surface = (
    <section
      ref={surfaceRef}
      className={`sheet-surface sheet-${mode} ${active ? "is-open" : "is-closing"} ${className}`}
      role={phoneSheetLayout ? role : undefined}
      aria-modal={phoneSheetLayout ? ariaModal : undefined}
      aria-label={ariaLabel}
      tabIndex={tabIndex}
      {...dragHandlers}
    >
      {children}
    </section>
  );

  if (mode === "modal") {
    return backdropMounted ? (
      <div
        ref={backdropRef}
        className={`sheet-backdrop ${backdropClassName} ${active ? "is-open" : "is-closing"}`}
        role="presentation"
        onClick={(event) => {
          if (event.target === event.currentTarget) onDismiss();
        }}
      >
        {surface}
      </div>
    ) : null;
  }

  const backdropElement = backdropMounted ? (
    <div
      ref={backdropRef}
      className={`sheet-backdrop ${backdropClassName} ${active ? "is-open" : "is-closing"}`}
      role="presentation"
      onClick={onDismiss}
    />
  ) : null;

  return (
    <>
      {backdropElement}
      {surface}
    </>
  );
}
