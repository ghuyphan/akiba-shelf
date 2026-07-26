import {
  type FocusEventHandler,
  type InputHTMLAttributes,
  type KeyboardEventHandler,
  type MouseEventHandler,
  useEffect,
  useRef,
  useState,
} from "react";
import { TextInput } from "./Field";

type NumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "inputMode" | "max" | "min" | "onChange" | "step" | "type" | "value"
> & {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  selectOnFocus?: boolean;
};

function clamp(value: number, min?: number, max?: number) {
  return Math.min(
    max ?? Number.POSITIVE_INFINITY,
    Math.max(min ?? Number.NEGATIVE_INFINITY, value),
  );
}

function cleanNumberInput(value: string, allowDecimal: boolean) {
  const normalized = value.replace(/,/g, ".");
  if (!allowDecimal) return normalized.replace(/\D/g, "");

  const [whole = "", ...fractionParts] = normalized
    .replace(/[^\d.]/g, "")
    .split(".");
  const hasDecimal = normalized.includes(".");
  const cleaned = hasDecimal ? `${whole}.${fractionParts.join("")}` : whole;
  return cleaned.startsWith(".") ? `0${cleaned}` : cleaned;
}

function decimalPlaces(value: number) {
  const [, fraction = ""] = String(value).split(".");
  return fraction.length;
}

export function NumberInput({
  value,
  min,
  max,
  step = 1,
  onChange,
  onBlur,
  onClick,
  onFocus,
  onKeyDown,
  selectOnFocus = true,
  className = "",
  ...props
}: NumberInputProps) {
  const [draft, setDraft] = useState(String(value));
  const editing = useRef(false);
  const selectOnClick = useRef(false);
  const allowDecimal =
    !Number.isInteger(step) ||
    (min != null && !Number.isInteger(min)) ||
    (max != null && !Number.isInteger(max));
  const precision = Math.min(
    6,
    Math.max(
      decimalPlaces(step),
      decimalPlaces(min ?? 0),
      decimalPlaces(max ?? 0),
      decimalPlaces(value),
    ),
  );

  useEffect(() => {
    if (!editing.current) setDraft(String(value));
  }, [value]);

  const handleFocus: FocusEventHandler<HTMLInputElement> = (event) => {
    editing.current = true;
    selectOnClick.current = selectOnFocus;
    if (selectOnFocus) event.currentTarget.select();
    onFocus?.(event);
  };

  const handleClick: MouseEventHandler<HTMLInputElement> = (event) => {
    if (selectOnClick.current) {
      event.currentTarget.select();
      selectOnClick.current = false;
    }
    onClick?.(event);
  };

  const handleBlur: FocusEventHandler<HTMLInputElement> = (event) => {
    editing.current = false;
    const parsed = draft.trim() ? Number(draft) : Number.NaN;
    const next = clamp(Number.isFinite(parsed) ? parsed : value, min, max);
    setDraft(String(next));
    if (next !== value) onChange(next);
    onBlur?.(event);
  };

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const direction = event.key === "ArrowUp" ? 1 : -1;
      const next = clamp(
        Number((value + direction * step).toFixed(precision)),
        min,
        max,
      );
      setDraft(String(next));
      if (next !== value) onChange(next);
    }
    onKeyDown?.(event);
  };

  return (
    <TextInput
      {...props}
      className={`input number-input ${className}`.trim()}
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      pattern={allowDecimal ? "[0-9]*[.,]?[0-9]*" : "[0-9]*"}
      value={draft}
      onClick={handleClick}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onChange={(event) => {
        const nextDraft = cleanNumberInput(event.target.value, allowDecimal);
        setDraft(nextDraft);

        if (!/^\d+(?:\.\d+)?$/.test(nextDraft)) return;
        const next = Number(nextDraft);
        if (
          Number.isFinite(next) &&
          (min == null || next >= min) &&
          (max == null || next <= max)
        ) {
          onChange(next);
        }
      }}
    />
  );
}
