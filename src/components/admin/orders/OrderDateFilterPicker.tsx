import { FloatingFocusManager, useInteractions } from "@floating-ui/react";
import {
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  History,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";
import { useAnchoredPopover } from "../../../hooks/shared/useAnchoredPopover";

type OrderDateFilterPickerProps = {
  value: boolean | string;
  onChange: (value: boolean | string) => void;
  disabled?: boolean;
};

function formatIsoDate(year: number, month: number, day: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

function parseIsoParts(dateStr: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function getPastDaysIsoRange(daysAgo: number) {
  const now = new Date();
  const past = new Date(now);
  past.setDate(past.getDate() - (daysAgo - 1));
  const fromIso = formatIsoDate(
    past.getFullYear(),
    past.getMonth() + 1,
    past.getDate(),
  );
  const toIso = formatIsoDate(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate(),
  );
  return `${fromIso}..${toIso}`;
}

export function OrderDateFilterPicker({
  value,
  onChange,
  disabled,
}: OrderDateFilterPickerProps) {
  const { locale, t } = usePlatformI18n();
  const dateLocale = locale === "vi" ? "vi-VN" : "en-US";
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState<string | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const isToday = value === true || value === "today";
  const isAllTime = value === false || value === "all";
  const customStr = !isToday && !isAllTime ? String(value) : "";

  const parsedRange = useMemo(() => {
    if (!customStr) return null;
    if (customStr.includes("..")) {
      const [startStr, endStr] = customStr.split("..");
      const startParts = parseIsoParts(startStr);
      const endParts = parseIsoParts(endStr);
      if (startParts && endParts) {
        return { start: startStr, end: endStr, startParts, endParts };
      }
    }
    const singleParts = parseIsoParts(customStr);
    if (singleParts) {
      return {
        start: customStr,
        end: customStr,
        startParts: singleParts,
        endParts: singleParts,
      };
    }
    return null;
  }, [customStr]);

  const today = useMemo(() => {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      iso: formatIsoDate(
        now.getFullYear(),
        now.getMonth() + 1,
        now.getDate(),
      ),
    };
  }, []);

  const [view, setView] = useState({
    year: parsedRange?.startParts.year ?? today.year,
    month: parsedRange?.startParts.month ?? today.month,
  });

  useEffect(() => {
    if (parsedRange) {
      setView({
        year: parsedRange.startParts.year,
        month: parsedRange.startParts.month,
      });
    }
  }, [parsedRange]);

  useEffect(() => {
    if (!open) {
      setDraftStart(null);
      setHoveredDate(null);
    }
  }, [open]);

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
    maxHeight: 520,
    scaleTransition: false,
  });

  const { getReferenceProps, getFloatingProps } =
    useInteractions(baseInteractions);

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

  function moveMonth(amount: number) {
    const next = new Date(view.year, view.month - 1 + amount, 1);
    setView({ year: next.getFullYear(), month: next.getMonth() + 1 });
  }

  function handleSelectDay(iso: string) {
    if (!draftStart) {
      // First click: start range selection
      setDraftStart(iso);
    } else {
      // Second click: finish range selection
      if (draftStart === iso) {
        onChange(iso);
      } else {
        const start = draftStart < iso ? draftStart : iso;
        const end = draftStart < iso ? iso : draftStart;
        onChange(`${start}..${end}`);
      }
      setDraftStart(null);
      setOpen(false);
    }
  }

  function handleSelectToday() {
    setDraftStart(null);
    onChange(true);
    setOpen(false);
  }

  function handleSelectLast7Days() {
    setDraftStart(null);
    onChange(getPastDaysIsoRange(7));
    setOpen(false);
  }

  function handleSelectLast30Days() {
    setDraftStart(null);
    onChange(getPastDaysIsoRange(30));
    setOpen(false);
  }

  function handleSelectAllTime() {
    setDraftStart(null);
    onChange(false);
    setOpen(false);
  }

  // Active range bounds for rendering calendar days
  const activeBounds = useMemo(() => {
    if (draftStart) {
      const second = hoveredDate ?? draftStart;
      const start = draftStart < second ? draftStart : second;
      const end = draftStart < second ? second : draftStart;
      return { start, end };
    }
    if (parsedRange) {
      return { start: parsedRange.start, end: parsedRange.end };
    }
    return null;
  }, [draftStart, hoveredDate, parsedRange]);

  const triggerLabel = isToday
    ? t("Today")
    : isAllTime
      ? t("All time")
      : parsedRange
        ? parsedRange.start === parsedRange.end
          ? new Intl.DateTimeFormat(dateLocale, {
              day: "numeric",
              month: "short",
              year: "numeric",
            }).format(
              new Date(
                parsedRange.startParts.year,
                parsedRange.startParts.month - 1,
                parsedRange.startParts.day,
              ),
            )
          : `${new Intl.DateTimeFormat(dateLocale, {
              day: "numeric",
              month: "short",
            }).format(
              new Date(
                parsedRange.startParts.year,
                parsedRange.startParts.month - 1,
                parsedRange.startParts.day,
              ),
            )} – ${new Intl.DateTimeFormat(dateLocale, {
              day: "numeric",
              month: "short",
              year: "numeric",
            }).format(
              new Date(
                parsedRange.endParts.year,
                parsedRange.endParts.month - 1,
                parsedRange.endParts.day,
              ),
            )}`
        : t("Today");

  return (
    <div className={`order-date-picker-wrap ${open ? "open" : ""}`}>
      <button
        ref={refs.setReference}
        type="button"
        className={`admin-toolbar-control admin-date-picker-trigger ${open ? "active" : ""}`}
        aria-label={`${t("Date filter")}: ${triggerLabel}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        {...getReferenceProps()}
      >
        {isToday ? (
          <CalendarDays size={14} aria-hidden="true" />
        ) : isAllTime ? (
          <History size={14} aria-hidden="true" />
        ) : (
          <Calendar size={14} aria-hidden="true" />
        )}
        <span>{triggerLabel}</span>
        <ChevronDown size={13} aria-hidden="true" style={{ opacity: 0.6 }} />
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
            className="date-time-popover order-date-filter-popover"
            data-placement={placement}
            style={{ ...floatingStyles, ...transitionStyles }}
            {...getFloatingProps({ "aria-label": t("Date filter") })}
          >
            {/* Quick action presets */}
            <div className="order-date-presets">
              <button
                type="button"
                className={`order-date-preset-btn ${isToday ? "active" : ""}`}
                onClick={handleSelectToday}
              >
                <CalendarDays size={12} />
                <span>{t("Today")}</span>
              </button>
              <button
                type="button"
                className={`order-date-preset-btn ${customStr === getPastDaysIsoRange(7) ? "active" : ""}`}
                onClick={handleSelectLast7Days}
              >
                <Calendar size={12} />
                <span>{t("7 days")}</span>
              </button>
              <button
                type="button"
                className={`order-date-preset-btn ${customStr === getPastDaysIsoRange(30) ? "active" : ""}`}
                onClick={handleSelectLast30Days}
              >
                <Calendar size={12} />
                <span>{t("30 days")}</span>
              </button>
              <button
                type="button"
                className={`order-date-preset-btn ${isAllTime ? "active" : ""}`}
                onClick={handleSelectAllTime}
              >
                <History size={12} />
                <span>{t("All time")}</span>
              </button>
            </div>

            {/* Custom Month Header */}
            <div className="date-time-calendar-head">
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                aria-label={t("Previous month")}
              >
                <ChevronLeft size={16} />
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
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Weekday columns */}
            <div className="date-time-weekdays" aria-hidden="true">
              {weekdays.map((weekday, index) => (
                <span key={`${weekday}-${index}`}>{weekday}</span>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="date-time-days">
              {days.map((date) => {
                const year = date.getFullYear();
                const month = date.getMonth() + 1;
                const day = date.getDate();
                const iso = formatIsoDate(year, month, day);
                const sameMonth = month === view.month;

                const isStart = activeBounds?.start === iso;
                const isEnd = activeBounds?.end === iso;
                const inRange =
                  Boolean(activeBounds) &&
                  activeBounds!.start <= iso &&
                  iso <= activeBounds!.end;

                const isCurrentDay = today.iso === iso;

                let dayClass = sameMonth ? "" : "outside";
                if (isStart && isEnd) {
                  dayClass += " active";
                } else if (isStart) {
                  dayClass += " range-start active";
                } else if (isEnd) {
                  dayClass += " range-end active";
                } else if (inRange) {
                  dayClass += " in-range";
                }
                if (isCurrentDay && !inRange) {
                  dayClass += " is-today";
                }

                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    className={dayClass.trim()}
                    aria-label={new Intl.DateTimeFormat(dateLocale, {
                      dateStyle: "full",
                    }).format(date)}
                    aria-current={isStart || isEnd ? "date" : undefined}
                    onMouseEnter={() => {
                      if (draftStart) setHoveredDate(iso);
                    }}
                    onClick={() => handleSelectDay(iso)}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </FloatingFocusManager>
      )}
    </div>
  );
}
