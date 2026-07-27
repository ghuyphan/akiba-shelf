import {
  FloatingFocusManager,
  useInteractions,
} from "@floating-ui/react";
import { Check, ChevronDown } from "lucide-react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { usePlatformI18n } from "../../lib/i18n/platformI18n";
import { useAnchoredPopover } from "./useAnchoredPopover";

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

type HsvColor = { h: number; s: number; v: number };

type ColorPickerProps = {
  value: string;
  label: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
  colors?: string[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeColor(value: string) {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed
      .slice(1)
      .split("")
      .map((part) => part + part)
      .join("")}`.toLowerCase();
  }
  return null;
}

export function hexToHsv(hex: string): HsvColor {
  const normalized = normalizeColor(hex) ?? "#000000";
  const red = Number.parseInt(normalized.slice(1, 3), 16) / 255;
  const green = Number.parseInt(normalized.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(normalized.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta > 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }

  if (hue < 0) hue += 360;
  return {
    h: hue,
    s: max === 0 ? 0 : (delta / max) * 100,
    v: max * 100,
  };
}

export function hsvToHex({ h, s, v }: HsvColor) {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clamp(s, 0, 100) / 100;
  const value = clamp(v, 0, 100) / 100;
  const chroma = value * saturation;
  const section = hue / 60;
  const x = chroma * (1 - Math.abs((section % 2) - 1));
  const match = value - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (section < 1) [red, green] = [chroma, x];
  else if (section < 2) [red, green] = [x, chroma];
  else if (section < 3) [green, blue] = [chroma, x];
  else if (section < 4) [green, blue] = [x, chroma];
  else if (section < 5) [red, blue] = [x, chroma];
  else [red, blue] = [chroma, x];

  return `#${[red, green, blue]
    .map((channel) =>
      Math.round((channel + match) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function readableInk(hex: string) {
  const normalized = normalizeColor(hex) ?? "#000000";
  const channels = [1, 3, 5].map((index) =>
    Number.parseInt(normalized.slice(index, index + 2), 16) / 255,
  );
  const linear = channels.map((channel) =>
    channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4,
  );
  const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  return luminance > 0.48 ? "#20304a" : "#ffffff";
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
  const normalizedValue = normalizeColor(value);
  const activeColor = normalizedValue ?? "#000000";
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [hsv, setHsv] = useState(() => hexToHsv(activeColor));
  const errorId = useId();
  const plane = useRef<HTMLDivElement>(null);
  const hue = useRef<HTMLDivElement>(null);

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
    onOpenChange: setOpen,
    role: "dialog",
  });
  const { getReferenceProps, getFloatingProps } = useInteractions(baseInteractions);

  useEffect(() => {
    setDraft(value);
    if (normalizedValue) setHsv(hexToHsv(normalizedValue));
  }, [normalizedValue, value]);

  function commit(next: string) {
    const normalized = normalizeColor(next);
    if (!normalized) return;
    setDraft(normalized);
    setHsv(hexToHsv(normalized));
    onChange(normalized);
  }

  function commitHsv(next: HsvColor) {
    const normalized = {
      h: ((next.h % 360) + 360) % 360,
      s: clamp(next.s, 0, 100),
      v: clamp(next.v, 0, 100),
    };
    const nextHex = hsvToHex(normalized);
    setHsv(normalized);
    setDraft(nextHex);
    onChange(nextHex);
  }

  function updateDraft(next: string) {
    setDraft(next);
    if (/^#[0-9a-f]{6}$/i.test(next.trim())) commit(next);
  }

  function updatePlane(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    commitHsv({
      ...hsv,
      s: ((event.clientX - rect.left) / rect.width) * 100,
      v: 100 - ((event.clientY - rect.top) / rect.height) * 100,
    });
  }

  function updateHue(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    commitHsv({
      ...hsv,
      h: ((event.clientX - rect.left) / rect.width) * 360,
    });
  }

  function beginDrag(
    event: PointerEvent<HTMLDivElement>,
    update: (event: PointerEvent<HTMLDivElement>) => void,
  ) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    update(event);
  }

  function continueDrag(
    event: PointerEvent<HTMLDivElement>,
    update: (event: PointerEvent<HTMLDivElement>) => void,
  ) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) update(event);
  }

  function handlePlaneKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 10 : 2;
    let next = hsv;
    if (event.key === "ArrowLeft") next = { ...hsv, s: hsv.s - step };
    else if (event.key === "ArrowRight") next = { ...hsv, s: hsv.s + step };
    else if (event.key === "ArrowUp") next = { ...hsv, v: hsv.v + step };
    else if (event.key === "ArrowDown") next = { ...hsv, v: hsv.v - step };
    else return;
    event.preventDefault();
    commitHsv(next);
  }

  function handleHueKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 10 : 1;
    let nextHue = hsv.h;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") nextHue -= step;
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") nextHue += step;
    else if (event.key === "Home") nextHue = 0;
    else if (event.key === "End") nextHue = 359;
    else return;
    event.preventDefault();
    commitHsv({ ...hsv, h: nextHue });
  }

  return (
    <div
      className={`color-picker ${compact ? "color-picker-compact" : ""} ${open ? "open" : ""} ${className}`.trim()}
    >
      <button
        ref={refs.setReference}
        type="button"
        className="color-picker-trigger"
        aria-label={`${label}: ${normalizedValue ?? value}`}
        disabled={disabled}
        data-invalid={!normalizedValue || undefined}
        {...getReferenceProps()}
      >
        <span
          className="color-picker-swatch"
          style={normalizedValue ? { background: normalizedValue } : undefined}
        />
        {!compact && <code>{normalizedValue ?? value}</code>}
        {!compact && <ChevronDown size={14} aria-hidden="true" />}
      </button>
      {isMounted && (
        <FloatingFocusManager
          context={context}
          modal={false}
          initialFocus={plane}
          returnFocus
        >
          <div
            ref={refs.setFloating}
            className="color-picker-popover"
            data-placement={placement}
            style={{ ...floatingStyles, ...transitionStyles }}
            {...getFloatingProps({
              "aria-label": t("Choose color for {{label}}", { label }),
            })}
          >
            <div className="color-picker-heading">
              <span
                className="color-picker-preview"
                style={{ background: activeColor }}
              />
              <span>
                <strong>{label}</strong>
                <small>{t("Choose a color, then fine-tune its hex value.")}</small>
              </span>
            </div>

            <div
              ref={plane}
              className="color-picker-plane"
              role="slider"
              tabIndex={0}
              aria-label={t("Saturation and brightness")}
              aria-valuetext={`${Math.round(hsv.s)}% ${t("saturation")}, ${Math.round(hsv.v)}% ${t("brightness")}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(hsv.v)}
              style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
              onPointerDown={(event) => beginDrag(event, updatePlane)}
              onPointerMove={(event) => continueDrag(event, updatePlane)}
              onKeyDown={handlePlaneKeyDown}
            >
              <span
                className="color-picker-plane-thumb"
                style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%` }}
              />
            </div>

            <div className="color-picker-hue-row">
              <span>{t("Hue")}</span>
              <div
                ref={hue}
                className="color-picker-hue"
                role="slider"
                tabIndex={0}
                aria-label={t("Hue")}
                aria-valuemin={0}
                aria-valuemax={359}
                aria-valuenow={Math.round(hsv.h)}
                onPointerDown={(event) => beginDrag(event, updateHue)}
                onPointerMove={(event) => continueDrag(event, updateHue)}
                onKeyDown={handleHueKeyDown}
              >
                <span
                  className="color-picker-hue-thumb"
                  style={{ left: `${(hsv.h / 360) * 100}%` }}
                />
              </div>
            </div>

            <div className="color-picker-presets" role="group" aria-label={t("Color presets")}>
              {colors.map((color) => {
                const normalized = normalizeColor(color);
                if (!normalized) return null;
                const selected = normalized === normalizedValue;
                return (
                  <button
                    key={color}
                    type="button"
                    className={selected ? "active" : ""}
                    aria-label={normalized}
                    aria-pressed={selected}
                    style={{ background: normalized, color: readableInk(normalized) }}
                    onClick={() => commit(normalized)}
                  >
                    {selected && <Check size={14} aria-hidden="true" />}
                  </button>
                );
              })}
            </div>

            <div className="color-picker-value-row">
              <label className="color-picker-value">
                <span>{t("Hex color")}</span>
                <input
                  type="text"
                  inputMode="text"
                  value={draft}
                  maxLength={7}
                  spellCheck={false}
                  aria-invalid={!normalizeColor(draft)}
                  aria-describedby={!normalizeColor(draft) ? errorId : undefined}
                  onChange={(event) => updateDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                  onBlur={() => {
                    const normalized = normalizeColor(draft);
                    if (normalized) commit(normalized);
                    else setDraft(value);
                  }}
                />
              </label>
              <label className="color-picker-system">
                <span>{t("System picker")}</span>
                <input
                  type="color"
                  value={activeColor}
                  aria-label={t("Open system color picker")}
                  onChange={(event) => commit(event.target.value)}
                />
              </label>
            </div>
            {!normalizeColor(draft) && (
              <small id={errorId} className="color-picker-error">
                {t("Use a 3 or 6 digit hex color.")}
              </small>
            )}
          </div>
        </FloatingFocusManager>
      )}
    </div>
  );
}
