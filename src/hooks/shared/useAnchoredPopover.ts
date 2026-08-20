import {
  autoUpdate,
  flip,
  offset,
  type Placement,
  shift,
  size,
  useClick,
  useDismiss,
  useFloating,
  useRole,
  useTransitionStyles,
} from "@floating-ui/react";

type AnchoredPopoverOptions = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: "dialog" | "listbox" | "menu";
  maxHeight?: number;
  placement?: Placement;
  scaleTransition?: boolean;
};

export function useAnchoredPopover({
  open,
  onOpenChange,
  role,
  maxHeight,
  placement = "bottom-start",
  scaleTransition = true,
}: AnchoredPopoverOptions) {
  const floating = useFloating({
    open,
    onOpenChange,
    placement,
    strategy: "fixed",
    transform: false,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(7),
      flip({ padding: 13 }),
      shift({ padding: 13 }),
      size({
        padding: 13,
        apply({ availableHeight, availableWidth, rects, elements }) {
          const height = maxHeight
            ? Math.min(maxHeight, availableHeight)
            : availableHeight;
          elements.floating.style.setProperty(
            "--floating-available-height",
            `${Math.max(0, height)}px`,
          );
          elements.floating.style.setProperty(
            "--floating-available-width",
            `${Math.max(0, availableWidth)}px`,
          );
          elements.floating.style.setProperty(
            "--floating-reference-width",
            `${rects.reference.width}px`,
          );
        },
      }),
      {
        name: "viewportClamp",
        fn({ x, y, rects }) {
          const viewport = window.visualViewport;
          const left = viewport?.offsetLeft ?? 0;
          const top = viewport?.offsetTop ?? 0;
          const width = Math.min(
            viewport?.width ?? Number.POSITIVE_INFINITY,
            window.innerWidth,
            document.documentElement.clientWidth,
          );
          const height = Math.min(
            viewport?.height ?? Number.POSITIVE_INFINITY,
            window.innerHeight,
            document.documentElement.clientHeight,
          );
          const minX = left + 13;
          const minY = top + 13;
          const maxX = Math.max(minX, left + width - rects.floating.width - 13);
          const maxY = Math.max(
            minY,
            top + height - rects.floating.height - 13,
          );
          return {
            x: Math.min(Math.max(x, minX), maxX),
            y: Math.min(Math.max(y, minY), maxY),
          };
        },
      },
    ],
  });
  const click = useClick(floating.context);
  const dismiss = useDismiss(floating.context);
  const roleInteraction = useRole(floating.context, { role });
  const transition = useTransitionStyles(floating.context, {
    duration: { open: 150, close: 110 },
    initial: scaleTransition
      ? { opacity: 0, transform: "scale(0.985)" }
      : { opacity: 0 },
    open: scaleTransition
      ? { opacity: 1, transform: "scale(1)" }
      : { opacity: 1 },
    close: scaleTransition
      ? { opacity: 0, transform: "scale(0.985)" }
      : { opacity: 0 },
  });

  return {
    ...floating,
    baseInteractions: [click, dismiss, roleInteraction],
    isMounted: transition.isMounted,
    transitionStyles: transition.styles,
  };
}
