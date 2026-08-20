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

export function OrderDateFilterPicker({
  value,
  onChange,
  disabled,
}: OrderDateFilterPickerProps) {
  const { locale, t } = usePlatformI18n();
  const dateLocale = locale === "vi" ? "vi-VN" : "en-US";
  const [open, setOpen] = useState(false);

  const isToday = value === true || value === "today";
  const isAllTime = value === false || value === "all";
  const customDateStr = !isToday && !isAllTime ? String(value) : "";

  const customParts = useMemo(() => {
    if (!customDateStr) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(customDateStr);
    if (!match) return null;
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
    };
  }, [customDateStr]);

  const today = useMemo(() => {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
    };
  }, []);

  const [view, setView] = useState({
    year: customParts?.year ?? today.year,
    month: customParts?.month ?? today.month,
  });

  useEffect(() => {
    if (customParts) {
      setView({ year: customParts.year, month: customParts.month });
    }
  }, [customParts]);

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
    maxHeight: 480,
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

  function handleSelectDay(year: number, month: number, day: number) {
    const iso = formatIsoDate(year, month, day);
    onChange(iso);
    setOpen(false);
  }

  function handleSelectToday() {
    onChange(true);
    setOpen(false);
  }

  function handleSelectAllTime() {
    onChange(false);
    setOpen(false);
  }

  const triggerLabel = isToday
    ? t("Today")
    : isAllTime
      ? t("All time")
      : customParts
        ? new Intl.DateTimeFormat(dateLocale, {
            day: "numeric",
            month: "short",
            year: "numeric",
          }).format(
            new Date(customParts.year, customParts.month - 1, customParts.day),
          )
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
                <CalendarDays size={13} />
                <span>{t("Today")}</span>
              </button>
              <button
                type="button"
                className={`order-date-preset-btn ${isAllTime ? "active" : ""}`}
                onClick={handleSelectAllTime}
              >
                <History size={13} />
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
                const sameMonth = month === view.month;
                const isSelected =
                  Boolean(customParts) &&
                  customParts?.year === year &&
                  customParts?.month === month &&
                  customParts?.day === day;
                const isCurrentDay =
                  today.year === year &&
                  today.month === month &&
                  today.day === day;

                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    className={`${sameMonth ? "" : "outside"} ${isSelected ? "active" : ""} ${isCurrentDay && !isSelected ? "is-today" : ""}`.trim()}
                    aria-label={new Intl.DateTimeFormat(dateLocale, {
                      dateStyle: "full",
                    }).format(date)}
                    aria-current={isSelected ? "date" : undefined}
                    onClick={() => handleSelectDay(year, month, day)}
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
