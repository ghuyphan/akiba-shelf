import { FloatingFocusManager, useInteractions } from "@floating-ui/react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePlatformI18n } from "../../lib/i18n/platformI18n";
import { SelectMenu } from "./SelectMenu";
import { useAnchoredPopover } from "../../hooks/shared/useAnchoredPopover";

type DateTimeInputProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  min?: string;
  disabled?: boolean;
  invalid?: boolean;
};

type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

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
  )
    return null;
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

export function DateTimeInput({
  value,
  onChange,
  label,
  min,
  disabled,
  invalid,
}: DateTimeInputProps) {
  const { locale, t } = usePlatformI18n();
  const selected = parseLocal(value);
  const minimum = min ? parseLocal(min) : null;
  const initial = selected ?? minimum ?? todayParts();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({
    year: initial.year,
    month: initial.month,
  });
  const [focusedDate, setFocusedDate] = useState<LocalParts>(initial);
  const dateLocale = locale === "vi" ? "vi-VN" : "en-US";
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
    maxHeight: 560,
    scaleTransition: false,
  });
  const { getReferenceProps, getFloatingProps } =
    useInteractions(baseInteractions);

  useEffect(() => {
    const next = parseLocal(value);
    if (next) {
      setView({ year: next.year, month: next.month });
      setFocusedDate(next);
    }
  }, [value]);

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
    const formatter = new Intl.DateTimeFormat(dateLocale, {
      weekday: "narrow",
    });
    return Array.from({ length: 7 }, (_, index) =>
      formatter.format(new Date(2024, 0, index + 1)),
    );
  }, [dateLocale]);

  const hourOptions = Array.from({ length: 24 }, (_, hour) => ({
    value: String(hour),
    label: String(hour).padStart(2, "0"),
  }));
  const minuteValues = Array.from(
    new Set([
      0,
      5,
      10,
      15,
      20,
      25,
      30,
      35,
      40,
      45,
      50,
      55,
      selected?.minute ?? 0,
    ]),
  ).sort((a, b) => a - b);
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

  function moveFocus(amount: number) {
    const current = new Date(
      focusedDate.year,
      focusedDate.month - 1,
      focusedDate.day,
    );
    current.setDate(current.getDate() + amount);
    const next = {
      year: current.getFullYear(),
      month: current.getMonth() + 1,
      day: current.getDate(),
      hour: focusedDate.hour,
      minute: focusedDate.minute,
    };
    const endOfDay = serialize({ ...next, hour: 23, minute: 59 });
    if (min && endOfDay < min) return;
    setFocusedDate(next);
    setView({ year: next.year, month: next.month });
    window.requestAnimationFrame(() => {
      refs.floating.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${serialize(next)}"]`)
        ?.focus();
    });
  }

  const display = selected
    ? new Intl.DateTimeFormat(dateLocale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(
        new Date(
          selected.year,
          selected.month - 1,
          selected.day,
          selected.hour,
          selected.minute,
        ),
      )
    : t("Choose date and time");

  return (
    <div className={`date-time-input ${open ? "open" : ""}`}>
      <div className="date-time-trigger-wrap">
        <button
          ref={refs.setReference}
          type="button"
          className={`date-time-trigger ${invalid ? "invalid" : ""}`.trim()}
          aria-label={`${label}: ${display}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={disabled}
          {...getReferenceProps()}
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
      {isMounted && (
        <FloatingFocusManager
          context={context}
          modal={false}
          initialFocus={-1}
          returnFocus
        >
          <div
            ref={refs.setFloating}
            className="date-time-popover"
            data-placement={placement}
            style={{ ...floatingStyles, ...transitionStyles }}
            {...getFloatingProps({ "aria-label": label })}
          >
            <div className="date-time-calendar-head">
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                aria-label={t("Previous month")}
              >
                <ChevronLeft size={17} />
              </button>
              <strong>
                {new Intl.DateTimeFormat(dateLocale, {
                  month: "long",
                  year: "numeric",
                }).format(new Date(view.year, view.month - 1, 1))}
              </strong>
              <button
                type="button"
                onClick={() => moveMonth(1)}
                aria-label={t("Next month")}
              >
                <ChevronRight size={17} />
              </button>
            </div>
            <div className="date-time-weekdays" aria-hidden="true">
              {weekdays.map((weekday, index) => (
                <span key={`${weekday}-${index}`}>{weekday}</span>
              ))}
            </div>
            <div className="date-time-days">
              {days.map((date) => {
                const sameMonth = date.getMonth() === view.month - 1;
                const active =
                  selected?.year === date.getFullYear() &&
                  selected.month === date.getMonth() + 1 &&
                  selected.day === date.getDate();
                const dateParts = {
                  year: date.getFullYear(),
                  month: date.getMonth() + 1,
                  day: date.getDate(),
                  hour: focusedDate.hour,
                  minute: focusedDate.minute,
                };
                const dayStart = serialize({
                  year: date.getFullYear(),
                  month: date.getMonth() + 1,
                  day: date.getDate(),
                  hour: 23,
                  minute: 59,
                });
                const unavailable = Boolean(min && dayStart < min);
                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    data-date={serialize(dateParts)}
                    className={`${sameMonth ? "" : "outside"} ${active ? "active" : ""}`.trim()}
                    disabled={unavailable}
                    tabIndex={
                      focusedDate.year === dateParts.year &&
                      focusedDate.month === dateParts.month &&
                      focusedDate.day === dateParts.day
                        ? 0
                        : -1
                    }
                    aria-label={new Intl.DateTimeFormat(dateLocale, {
                      dateStyle: "full",
                    }).format(date)}
                    aria-current={active ? "date" : undefined}
                    aria-pressed={active}
                    onFocus={() => setFocusedDate(dateParts)}
                    onClick={() => update(dateParts)}
                    onKeyDown={(event) => {
                      const offsets: Record<string, number> = {
                        ArrowLeft: -1,
                        ArrowRight: 1,
                        ArrowUp: -7,
                        ArrowDown: 7,
                      };
                      const offset = offsets[event.key];
                      if (!offset) return;
                      event.preventDefault();
                      moveFocus(offset);
                    }}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="date-time-clock">
              <Clock3 size={16} aria-hidden="true" />
              <SelectMenu
                label={t("Hour")}
                value={String(selected?.hour ?? initial.hour)}
                options={hourOptions}
                onChange={(hour) => update({ hour: Number(hour) })}
              />
              <span>:</span>
              <SelectMenu
                label={t("Minute")}
                value={String(selected?.minute ?? initial.minute)}
                options={minuteOptions}
                onChange={(minute) => update({ minute: Number(minute) })}
              />
            </div>
            <button
              type="button"
              className="date-time-done"
              onClick={() => {
                if (!selected) update({});
                setOpen(false);
                queueMicrotask(() => {
                  const reference = refs.domReference.current;
                  if (reference instanceof HTMLElement) reference.focus();
                });
              }}
            >
              {t("Done")}
            </button>
          </div>
        </FloatingFocusManager>
      )}
    </div>
  );
}
