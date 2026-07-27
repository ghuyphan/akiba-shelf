import {
  FloatingFocusManager,
  useInteractions,
  useListNavigation,
} from "@floating-ui/react";
import { type ReactNode, useRef, useState } from "react";
import { useAnchoredPopover } from "./useAnchoredPopover";

export type ActionMenuItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  danger?: boolean;
  title?: string;
  onSelect: () => void;
};

type ActionMenuProps = {
  label: string;
  items: ActionMenuItem[];
  triggerIcon: ReactNode;
  className?: string;
  triggerClassName?: string;
  popoverClassName?: string;
  itemClassName?: string;
};

export function ActionMenu({
  label,
  items,
  triggerIcon,
  className = "",
  triggerClassName = "",
  popoverClassName = "",
  itemClassName = "",
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const disabledIndices = items.flatMap((item, index) =>
    item.disabled ? [index] : [],
  );
  const firstEnabledIndex = items.findIndex((item) => !item.disabled);
  const hasEnabledItems = firstEnabledIndex >= 0;

  const {
    refs,
    floatingStyles,
    context,
    placement,
    baseInteractions,
    isMounted,
    transitionStyles,
  } = useAnchoredPopover({
    open,
    onOpenChange(nextOpen) {
      setOpen(nextOpen);
      setActiveIndex(nextOpen ? firstEnabledIndex : null);
    },
    role: "menu",
    placement: "bottom-end",
    maxHeight: 360,
  });
  const navigation = useListNavigation(context, {
    listRef: itemRefs,
    activeIndex,
    disabledIndices,
    loop: true,
    focusItemOnOpen: true,
    scrollItemIntoView: { block: "nearest" },
    onNavigate: setActiveIndex,
  });
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions(
    [...baseInteractions, navigation],
  );

  function select(item: ActionMenuItem) {
    if (item.disabled) return;
    setOpen(false);
    setActiveIndex(null);
    item.onSelect();
    queueMicrotask(() => {
      const reference = refs.domReference.current;
      if (reference instanceof HTMLElement) reference.focus();
    });
  }

  return (
    <div className={`action-menu ${open ? "open" : ""} ${className}`.trim()}>
      <button
        ref={refs.setReference}
        type="button"
        className={triggerClassName}
        aria-label={label}
        title={label}
        disabled={!hasEnabledItems}
        {...getReferenceProps()}
      >
        {triggerIcon}
      </button>
      {isMounted && (
        <FloatingFocusManager
          context={context}
          modal={false}
          initialFocus={0}
          returnFocus
        >
          <div
            ref={refs.setFloating}
            className={`action-menu-popover ${popoverClassName}`.trim()}
            data-placement={placement}
            style={{ ...floatingStyles, ...transitionStyles }}
            {...getFloatingProps({ "aria-label": label })}
          >
            {items.map((item, index) => (
              <button
                key={item.id}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                type="button"
                role="menuitem"
                tabIndex={index === activeIndex ? 0 : -1}
                className={`${itemClassName} ${item.danger ? "danger" : ""}`.trim()}
                disabled={item.disabled}
                title={item.title}
                {...getItemProps({
                  onClick: () => select(item),
                  onFocus: () => setActiveIndex(index),
                })}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </FloatingFocusManager>
      )}
    </div>
  );
}
