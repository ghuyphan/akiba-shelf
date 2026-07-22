import { CalendarDays, ChevronLeft, ChevronRight, Clock3, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePlatformI18n } from "../../lib/i18n/platformI18n";
import { SelectMenu } from "./SelectMenu";

type DateTimeInputProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  min?: string;
  disabled?: boolean;
  invalid?: boolean;
};

type LocalParts = { year: number; month: number; day: number; hour: number; minute: number };

function parseLocal(value: string): LocalParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) return null;
  return { year, month, day, hour, minute };
}

function serialize(parts: LocalParts) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

function todayParts(): LocalParts {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: 9,
    minute: 0,
  };
}

export function DateTimeInput({ value, onChange, label, min, disabled, invalid }: DateTimeInputProps) {
  const { locale, t } = usePlatformI18n();
  const selected = parseLocal(value);
  const minimum = min ? parseLocal(min) : null;
  const initial = selected ?? minimum ?? todayParts();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ year: initial.year, month: initial.month });
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dateLocale = locale === "vi" ? "vi-VN" : "en-US";

  useEffect(() => {
    const next = parseLocal(value);
    if (next) setView({ year: next.year, month: next.month });
  }, [value]);

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

  const days = useMemo(() => {
    const first = new Date(view.year, view.month - 1, 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const start = new Date(view.year, view.month - 1, 1 - mondayOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [view]);

  const weekdays = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(dateLocale, { weekday: "narrow" });
    return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(2024, 0, index + 1)));
  }, [dateLocale]);

  const hourOptions = Array.from({ length: 24 }, (_, hour) => ({
    value: String(hour),
    label: String(hour).padStart(2, "0"),
  }));
  const minuteValues = Array.from(new Set([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, selected?.minute ?? 0])).sort((a, b) => a - b);
  const minuteOptions = minuteValues.map((minute) => ({
    value: String(minute),
    label: String(minute).padStart(2, "0"),
  }));

  function update(changes: Partial<LocalParts>) {
    const next = { ...(selected ?? minimum ?? todayParts()), ...changes };
    const serialized = serialize(next);
    if (min && serialized < min) return;
    onChange(serialized);
  }

  function moveMonth(amount: number) {
    const next = new Date(view.year, view.month - 1 + amount, 1);
    setView({ year: next.getFullYear(), month: next.getMonth() + 1 });
  }

  const display = selected
    ? new Intl.DateTimeFormat(dateLocale, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(selected.year, selected.month - 1, selected.day, selected.hour, selected.minute),
      )
    : t("Choose date and time");

  return (
    <div ref={root} className={`date-time-input ${open ? "open" : ""}`}>
      <div className="date-time-trigger-wrap">
        <button
          ref={trigger}
          type="button"
          className={`date-time-trigger ${invalid ? "invalid" : ""}`.trim()}
          aria-label={`${label}: ${display}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
        >
          <CalendarDays size={17} aria-hidden="true" />
          <span className={selected ? "" : "placeholder"}>{display}</span>
        </button>
        {selected && !disabled && (
          <button
            type="button"
            className="date-time-clear"
            aria-label={t("Clear {{label}}", { label })}
            onClick={(event) => {
              event.stopPropagation();
              onChange("");
            }}
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>
      {open && (
        <div className="date-time-popover" role="dialog" aria-label={label}>
          <div className="date-time-calendar-head">
            <button type="button" onClick={() => moveMonth(-1)} aria-label={t("Previous month")}><ChevronLeft size={17} /></button>
            <strong>{new Intl.DateTimeFormat(dateLocale, { month: "long", year: "numeric" }).format(new Date(view.year, view.month - 1, 1))}</strong>
            <button type="button" onClick={() => moveMonth(1)} aria-label={t("Next month")}><ChevronRight size={17} /></button>
          </div>
          <div className="date-time-weekdays" aria-hidden="true">
            {weekdays.map((weekday, index) => <span key={`${weekday}-${index}`}>{weekday}</span>)}
          </div>
          <div className="date-time-days">
            {days.map((date) => {
              const sameMonth = date.getMonth() === view.month - 1;
              const active = selected?.year === date.getFullYear() && selected.month === date.getMonth() + 1 && selected.day === date.getDate();
              const dayStart = serialize({ year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), hour: 23, minute: 59 });
              const unavailable = Boolean(min && dayStart < min);
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  className={`${sameMonth ? "" : "outside"} ${active ? "active" : ""}`.trim()}
                  disabled={unavailable}
                  aria-pressed={active}
                  onClick={() => update({ year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() })}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          <div className="date-time-clock">
            <Clock3 size={16} aria-hidden="true" />
            <SelectMenu label={t("Hour")} value={String(selected?.hour ?? initial.hour)} options={hourOptions} onChange={(hour) => update({ hour: Number(hour) })} />
            <span>:</span>
            <SelectMenu label={t("Minute")} value={String(selected?.minute ?? initial.minute)} options={minuteOptions} onChange={(minute) => update({ minute: Number(minute) })} />
          </div>
          <button type="button" className="date-time-done" onClick={() => { if (!selected) update({}); setOpen(false); trigger.current?.focus(); }}>{t("Done")}</button>
        </div>
      )}
    </div>
  );
}
