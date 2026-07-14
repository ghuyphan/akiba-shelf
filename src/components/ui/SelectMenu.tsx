import { Check, ChevronDown } from "lucide-react";
import { ReactNode, useEffect, useId, useRef, useState } from "react";

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
};

export function SelectMenu({
  value,
  options,
  onChange,
  label,
  disabled,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();
  const selected =
    options.find((option) => option.value === value) ?? options[0];
  const enabledIndexes = options.flatMap((option, index) =>
    option.disabled ? [] : [index],
  );
  const scrollingOptions = options.flatMap((option, index) =>
    option.fixed ? [] : [{ option, index }],
  );
  const fixedOptions = options.flatMap((option, index) =>
    option.fixed ? [{ option, index }] : [],
  );

  function focusOption(index: number) {
    setActiveIndex(index);
  }

  function openMenu(preferred?: "first" | "last") {
    if (disabled || !enabledIndexes.length) return;
    setOpen(true);
    const selectedIndex = options.findIndex(
      (option) => option.value === value && !option.disabled,
    );
    focusOption(
      preferred === "first"
        ? enabledIndexes[0]
        : preferred === "last"
          ? enabledIndexes.at(-1)!
          : selectedIndex >= 0
            ? selectedIndex
            : enabledIndexes[0],
    );
  }

  function closeMenu(restoreFocus = false) {
    setOpen(false);
    setActiveIndex(-1);
    if (restoreFocus) trigger.current?.focus();
  }

  function move(delta: number) {
    const position = Math.max(0, enabledIndexes.indexOf(activeIndex));
    focusOption(
      enabledIndexes[
        (position + delta + enabledIndexes.length) % enabledIndexes.length
      ],
    );
  }

  function handleOptionKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    option: SelectMenuOption,
  ) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusOption(enabledIndexes[0]);
    } else if (event.key === "End") {
      event.preventDefault();
      focusOption(enabledIndexes.at(-1)!);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
    } else if (event.key === "Tab") {
      closeMenu();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onChange(option.value);
      closeMenu(true);
    }
  }

  function renderOption(option: SelectMenuOption, index: number) {
    return (
      <button
        key={option.value}
        ref={(node) => {
          optionRefs.current[index] = node;
        }}
        type="button"
        role="option"
        tabIndex={index === activeIndex ? 0 : -1}
        aria-selected={option.value === value}
        disabled={option.disabled}
        className={option.value === value ? "active" : ""}
        onFocus={() => setActiveIndex(index)}
        onClick={() => {
          onChange(option.value);
          closeMenu(true);
        }}
        onKeyDown={(event) => handleOptionKeyDown(event, option)}
      >
        {option.icon && <span className="select-menu-icon">{option.icon}</span>}
        <span className="select-menu-copy">
          <strong>{option.label}</strong>
          {option.description && <small>{option.description}</small>}
        </span>
        {option.value === value && <Check size={15} />}
      </button>
    );
  }

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) closeMenu();
    };
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  });
  useEffect(() => {
    if (open && activeIndex >= 0) optionRefs.current[activeIndex]?.focus();
  }, [activeIndex, open]);

  return (
    <div
      ref={root}
      className={`select-menu ${open ? "open" : ""} ${className}`}
    >
      <button
        ref={trigger}
        type="button"
        className="select-menu-trigger"
        disabled={disabled}
        aria-label={`${label}: ${selected?.label ?? ""}`}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-expanded={open}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={(event) => {
          if (
            event.key === "ArrowDown" ||
            event.key === "ArrowUp" ||
            event.key === "Home" ||
            event.key === "End" ||
            event.key === " "
          ) {
            event.preventDefault();
            openMenu(
              event.key === "ArrowUp" || event.key === "End" ? "last" : "first",
            );
          }
        }}
      >
        {selected?.icon && (
          <span className="select-menu-icon">{selected.icon}</span>
        )}
        <span className="select-menu-copy">
          <strong>{selected?.label}</strong>
          {selected?.description && <small>{selected.description}</small>}
        </span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div
          id={listboxId}
          className="select-menu-popover"
          role="listbox"
          aria-label={label}
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
      )}
    </div>
  );
}
