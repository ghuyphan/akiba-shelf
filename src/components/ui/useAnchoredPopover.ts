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
      flip({ padding: 12 }),
      shift({ padding: 12 }),
      size({
        padding: 12,
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
