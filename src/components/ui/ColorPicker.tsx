import { Check, Pipette } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePlatformI18n } from "../../lib/i18n/platformI18n";

const DEFAULT_COLORS = [
  "#5f8d55",
  "#20304a",
  "#e76f51",
  "#f4a261",
  "#2a9d8f",
  "#457b9d",
  "#d95c68",
  "#f8f5ef",
  "#ffffff",
  "#111827",
];

type ColorPickerProps = {
  value: string;
  label: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
  colors?: string[];
};

function normalizeColor(value: string) {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed.slice(1).split("").map((part) => part + part).join("")}`.toLowerCase();
  }
  return null;
}

export function ColorPicker({
  value,
  label,
  onChange,
  disabled,
  className = "",
  compact = false,
  colors = DEFAULT_COLORS,
}: ColorPickerProps) {
  const { t } = usePlatformI18n();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const normalizedValue = normalizeColor(value) ?? "#5f8d55";

  useEffect(() => setDraft(value), [value]);

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    }
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function commit(next: string) {
    const normalized = normalizeColor(next);
    setDraft(next);
    if (normalized) onChange(normalized);
  }

  function updateDraft(next: string) {
    setDraft(next);
    if (/^#[0-9a-f]{6}$/i.test(next.trim())) onChange(next.trim().toLowerCase());
  }

  return (
    <div
      ref={root}
      className={`color-picker ${compact ? "color-picker-compact" : ""} ${open ? "open" : ""} ${className}`.trim()}
    >
      <button
        ref={trigger}
        type="button"
        className="color-picker-trigger"
        aria-label={`${label}: ${normalizedValue}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="color-picker-swatch" style={{ background: normalizedValue }} />
        {!compact && <code>{normalizedValue}</code>}
        {!compact && <Pipette size={14} aria-hidden="true" />}
      </button>
      {open && (
        <div className="color-picker-popover" role="dialog" aria-label={t("Choose color for {{label}}", { label })}>
          <div className="color-picker-heading">
            <span className="color-picker-preview" style={{ background: normalizedValue }} />
            <span>
              <strong>{label}</strong>
              <small>{t("Choose a preset or enter a hex color.")}</small>
            </span>
          </div>
          <div className="color-picker-presets" role="group" aria-label={t("Color presets")}>
            {colors.map((color) => {
              const normalized = normalizeColor(color) ?? color;
              const selected = normalized === normalizedValue;
              return (
                <button
                  key={color}
                  type="button"
                  className={selected ? "active" : ""}
                  aria-label={color}
                  aria-pressed={selected}
                  style={{ background: color }}
                  onClick={() => commit(color)}
                >
                  {selected && <Check size={14} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <label className="color-picker-value">
            <span>{t("Hex color")}</span>
            <input
              type="text"
              inputMode="text"
              value={draft}
              maxLength={7}
              spellCheck={false}
              aria-invalid={!normalizeColor(draft)}
              onChange={(event) => updateDraft(event.target.value)}
              onBlur={() => {
                const normalized = normalizeColor(draft);
                if (normalized) onChange(normalized);
                setDraft(normalized ?? normalizedValue);
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}
