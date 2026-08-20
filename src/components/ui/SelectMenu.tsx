import {
  FloatingFocusManager,
  useInteractions,
  useListNavigation,
  useTypeahead,
} from "@floating-ui/react";
import { Check, ChevronDown } from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";
import { useAnchoredPopover } from "../../hooks/shared/useAnchoredPopover";

export type SelectMenuOption = {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
  fixed?: boolean;
};

type Props = {
  value: string;
  options: SelectMenuOption[];
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
  className?: string;
  triggerIcon?: ReactNode;
};

export function SelectMenu({
  value,
  options,
  onChange,
  label,
  disabled,
  className = "",
  triggerIcon,
}: Props) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const itemLabels = useRef<Array<string | null>>([]);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : options[0];
  const disabledIndices = options.flatMap((option, index) =>
    option.disabled ? [index] : [],
  );
  const hasEnabledOptions = disabledIndices.length < options.length;
  const scrollingOptions = options.flatMap((option, index) =>
    option.fixed ? [] : [{ option, index }],
  );
  const fixedOptions = options.flatMap((option, index) =>
    option.fixed ? [{ option, index }] : [],
  );

  itemLabels.current = options.map((option) =>
    option.disabled ? null : option.label,
  );

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
      if (!nextOpen) setActiveIndex(null);
    },
    role: "listbox",
    maxHeight: 360,
  });
  const navigation = useListNavigation(context, {
    listRef: itemRefs,
    activeIndex,
    selectedIndex: selectedIndex >= 0 ? selectedIndex : null,
    disabledIndices,
    loop: true,
    focusItemOnOpen: "auto",
    scrollItemIntoView: { block: "nearest" },
    onNavigate: setActiveIndex,
  });
  const typeahead = useTypeahead(context, {
    listRef: itemLabels,
    activeIndex,
    selectedIndex: selectedIndex >= 0 ? selectedIndex : null,
    enabled: open,
    onMatch: setActiveIndex,
  });
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    ...baseInteractions,
    navigation,
    typeahead,
  ]);

  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, options.length);
    if (open && activeIndex != null && options[activeIndex]?.disabled) {
      setActiveIndex(null);
    }
  }, [activeIndex, open, options]);

  function choose(option: SelectMenuOption) {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
    setActiveIndex(null);
    queueMicrotask(() => {
      const reference = refs.domReference.current;
      if (reference instanceof HTMLElement) reference.focus();
    });
  }

  function renderOption(option: SelectMenuOption, index: number) {
    return (
      <button
        key={option.value}
        ref={(node) => {
          itemRefs.current[index] = node;
        }}
        type="button"
        role="option"
        tabIndex={index === activeIndex ? 0 : -1}
        aria-selected={option.value === value}
        disabled={option.disabled}
        className={option.value === value ? "active" : ""}
        {...getItemProps({
          onClick: () => choose(option),
          onFocus: () => setActiveIndex(index),
        })}
      >
        {option.icon && <span className="select-menu-icon">{option.icon}</span>}
        <span className="select-menu-copy">
          <strong>{option.label}</strong>
          {option.description && <small>{option.description}</small>}
        </span>
        {option.value === value && <Check size={15} aria-hidden="true" />}
      </button>
    );
  }

  return (
    <div className={`select-menu ${open ? "open" : ""} ${className}`.trim()}>
      <button
        ref={refs.setReference}
        type="button"
        className="select-menu-trigger"
        disabled={disabled || !hasEnabledOptions}
        aria-label={`${label}: ${selected?.label ?? ""}`}
        {...getReferenceProps()}
      >
        {triggerIcon && <span className="select-menu-icon">{triggerIcon}</span>}
        {selected?.icon && (
          <span className="select-menu-icon">{selected.icon}</span>
        )}
        <span className="select-menu-copy">
          <strong>{selected?.label}</strong>
          {selected?.description && <small>{selected.description}</small>}
        </span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {isMounted && (
        <FloatingFocusManager
          context={context}
          modal={false}
          initialFocus={-1}
          returnFocus
        >
          <div
            ref={refs.setFloating}
            className="select-menu-popover"
            data-placement={placement}
            style={{ ...floatingStyles, ...transitionStyles }}
            {...getFloatingProps({ "aria-label": label })}
          >
            <div className="select-menu-options" role="presentation">
              {scrollingOptions.map(({ option, index }) =>
                renderOption(option, index),
              )}
            </div>
            {fixedOptions.length > 0 && (
              <div className="select-menu-fixed-options" role="presentation">
                {fixedOptions.map(({ option, index }) =>
                  renderOption(option, index),
                )}
              </div>
            )}
          </div>
        </FloatingFocusManager>
      )}
    </div>
  );
}
