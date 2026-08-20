import {
  useEffect,
  useRef,
  type MouseEventHandler,
  type PointerEvent as ReactPointerEvent,
  type PointerEventHandler,
  type RefObject,
} from "react";

type SheetDrag = {
  pointerId: number;
  startY: number;
  lastY: number;
  lastTime: number;
  velocity: number;
  moved: boolean;
};

type UseMobileSheetDragOptions = {
  active: boolean;
  dismissible: boolean;
  isPhoneLayout: boolean;
  mode: "modal" | "expandable";
  onDismiss: () => void;
  surfaceRef: RefObject<HTMLElement | null>;
};

type SheetDragHandlers = {
  onPointerDown: PointerEventHandler<HTMLElement>;
  onPointerMove: PointerEventHandler<HTMLElement>;
  onPointerUp: PointerEventHandler<HTMLElement>;
  onPointerCancel: PointerEventHandler<HTMLElement>;
  onClickCapture: MouseEventHandler<HTMLElement>;
};

const DRAG_START_PX = 6;
const DISMISS_DISTANCE_PX = 96;
const DISMISS_VELOCITY_PX_PER_MS = 0.7;
const UPWARD_RESISTANCE = 0.18;
const DISMISS_DURATION_MS = 180;
const SETTLE_DURATION_MS = 280;
const TRANSITION_EASING = "cubic-bezier(.22, 1, .36, 1)";
const INTERACTIVE_HEADER_TARGETS =
  "button, a, input, select, textarea, [role='button']";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function setTransform(surface: HTMLElement, offset: number) {
  surface.style.setProperty(
    "transform",
    `translate3d(0, ${offset}px, 0)`,
    "important",
  );
}

function clearDragStyles(surface: HTMLElement) {
  surface.style.removeProperty("transform");
  surface.style.removeProperty("transition");
  surface.style.removeProperty("animation");
  surface.style.removeProperty("will-change");
}

function isDragStartTarget(surface: HTMLElement, target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  const handle = target.closest("[data-sheet-drag-handle]");
  if (handle) return surface.contains(handle);

  const header = target.closest("[data-sheet-drag-region]");
  return Boolean(
    header &&
      !target.closest(INTERACTIVE_HEADER_TARGETS) &&
      surface.contains(header),
  );
}

export function useMobileSheetDrag({
  active,
  dismissible,
  isPhoneLayout,
  mode,
  onDismiss,
  surfaceRef,
}: UseMobileSheetDragOptions): SheetDragHandlers {
  const dragRef = useRef<SheetDrag | null>(null);
  const timerRef = useRef<number | null>(null);
  const dismissedRef = useRef(false);
  const suppressClickRef = useRef(false);

  function clearTimer() {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  function animateTransform(
    surface: HTMLElement,
    offset: number,
    duration: number,
    onComplete: () => void,
  ) {
    surface.style.setProperty(
      "transition",
      `transform ${duration}ms ${TRANSITION_EASING}`,
      "important",
    );
    setTransform(surface, offset);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      onComplete();
    }, duration);
  }

  useEffect(() => {
    const surface = surfaceRef.current;
    if (active) {
      dismissedRef.current = false;
      if (surface) clearDragStyles(surface);
    } else {
      clearTimer();
      dragRef.current = null;
      if (surface && (mode === "expandable" || !dismissedRef.current)) {
        clearDragStyles(surface);
      }
    }
    return clearTimer;
  }, [active, mode, surfaceRef]);

  function startDrag(event: ReactPointerEvent<HTMLElement>) {
    const surface = event.currentTarget;
    if (
      !active ||
      !dismissible ||
      !isPhoneLayout ||
      event.isPrimary === false ||
      event.button > 0 ||
      !isDragStartTarget(surface, event.target)
    ) {
      return;
    }

    clearTimer();
    surface.style.setProperty("animation", "none", "important");
    surface.style.setProperty("transition", "none", "important");
    surface.style.setProperty("will-change", "transform");
    try {
      surface.setPointerCapture?.(event.pointerId);
    } catch {
      // The browser may have already cancelled the contact.
    }
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocity: 0,
      moved: false,
    };
  }

  function moveDrag(event: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaY = event.clientY - drag.startY;
    const height = event.currentTarget.getBoundingClientRect().height || 384;
    const offset =
      deltaY < 0
        ? Math.max(deltaY * UPWARD_RESISTANCE, -18)
        : Math.min(deltaY, height + 24);
    const elapsed = event.timeStamp - drag.lastTime;
    if (elapsed > 0) {
      const velocity = (event.clientY - drag.lastY) / elapsed;
      drag.velocity = drag.velocity * 0.75 + velocity * 0.25;
    }
    drag.lastY = event.clientY;
    drag.lastTime = event.timeStamp;
    drag.moved ||= Math.abs(deltaY) >= DRAG_START_PX;
    setTransform(event.currentTarget, offset);
    if (drag.moved) event.preventDefault();
  }

  function finishDrag(
    event: ReactPointerEvent<HTMLElement>,
    allowDismiss = true,
  ) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;

    const surface = event.currentTarget;
    try {
      surface.releasePointerCapture?.(event.pointerId);
    } catch {
      // The browser may have already released the contact.
    }

    const distance = Math.max(0, event.clientY - drag.startY);
    const height = surface.getBoundingClientRect().height || 384;
    const shouldDismiss =
      allowDismiss &&
      (distance >= Math.min(DISMISS_DISTANCE_PX, height * 0.25) ||
        (distance >= 48 && drag.velocity >= DISMISS_VELOCITY_PX_PER_MS));

    if (drag.moved) suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);

    const reducedMotion = prefersReducedMotion();
    if (shouldDismiss) {
      animateTransform(
        surface,
        height + 16,
        reducedMotion ? 0 : DISMISS_DURATION_MS,
        () => {
          dismissedRef.current = true;
          onDismiss();
        },
      );
      return;
    }

    animateTransform(surface, 0, reducedMotion ? 0 : SETTLE_DURATION_MS, () => {
      surface.style.removeProperty("transition");
      surface.style.removeProperty("will-change");
    });
  }

  return {
    onPointerDown: startDrag,
    onPointerMove: moveDrag,
    onPointerUp: finishDrag,
    onPointerCancel: (event) => finishDrag(event, false),
    onClickCapture: (event) => {
      if (
        !suppressClickRef.current ||
        !(event.target instanceof Element) ||
        !event.target.closest(".mobile-sheet-handle")
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      suppressClickRef.current = false;
    },
  };
}
