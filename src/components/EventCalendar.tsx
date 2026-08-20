"use client";

import { useState } from "react";
import Link from "next/link";
import { eventTypeLabel } from "@/lib/eventTypes";
import styles from "@/styles/ui.module.css";

type CalendarEvent = { id: string; title: string; start_time: string; type?: string };

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE_PER_DAY = 3;

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

// YYYY-MM-DD, for the ?date= param the New Event page reads to pre-fill a
// start time — distinct from dayKey() above, which isn't zero-padded and
// isn't meant to round-trip through a URL.
function toDateInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function buildGrid(monthStart: Date): Date[] {
  const gridStart = new Date(monthStart);
  gridStart.setDate(1 - monthStart.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + i);
    return day;
  });
}

export function EventCalendar({
  events,
  today,
  minMonth,
  maxMonth,
  canCreateEvents = false,
}: {
  events: CalendarEvent[];
  today: string;
  minMonth: string;
  maxMonth: string;
  canCreateEvents?: boolean;
}) {
  const todayDate = new Date(today);
  const [monthStart, setMonthStart] = useState(startOfMonth(todayDate));
  const [selectedDay, setSelectedDay] = useState(todayDate);

  const min = startOfMonth(new Date(minMonth));
  const max = startOfMonth(new Date(maxMonth));

  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = dayKey(new Date(event.start_time));
    const list = eventsByDay.get(key) ?? [];
    list.push(event);
    eventsByDay.set(key, list);
  }

  const days = buildGrid(monthStart);
  const monthLabel = monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const selectedDayEvents = (eventsByDay.get(dayKey(selectedDay)) ?? [])
    .slice()
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const selectedDayLabel = selectedDay.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className={styles.calendar}>
      <div className={styles.calendarHeader}>
        <button
          type="button"
          className={`${styles.button} ${styles.buttonSecondary}`}
          disabled={monthStart <= min}
          onClick={() => setMonthStart((current) => addMonths(current, -1))}
        >
          ← Prev
        </button>
        <h2 className={styles.calendarTitle}>{monthLabel}</h2>
        <button
          type="button"
          className={`${styles.button} ${styles.buttonSecondary}`}
          disabled={monthStart >= max}
          onClick={() => setMonthStart((current) => addMonths(current, 1))}
        >
          Next →
        </button>
      </div>
      <div className={styles.calendarGrid}>
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className={styles.calendarWeekday}>
            {label}
          </div>
        ))}
        {days.map((day) => {
          const key = dayKey(day);
          const dayEvents = eventsByDay.get(key) ?? [];
          const outside = day.getMonth() !== monthStart.getMonth();
          const cellClass = [
            outside ? styles.calendarDayOutside : styles.calendarDay,
            isSameDay(day, todayDate) && styles.calendarDayToday,
            isSameDay(day, selectedDay) && styles.calendarDaySelected,
          ]
            .filter(Boolean)
            .join(" ");
          const visible = dayEvents.slice(0, MAX_VISIBLE_PER_DAY);
          const extra = dayEvents.length - visible.length;

          return (
            <div key={key} className={cellClass} onClick={() => setSelectedDay(day)}>
              <button
                type="button"
                className={styles.calendarDayNumber}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedDay(day);
                }}
                aria-label={`View events for ${day.toLocaleDateString(undefined, { month: "long", day: "numeric" })}`}
              >
                {day.getDate()}
              </button>
              {visible.map((event) => (
                <Link
                  key={event.id}
                  href={`/schedule/${event.id}`}
                  className={styles.calendarEvent}
                  onClick={(e) => e.stopPropagation()}
                >
                  {event.title}
                </Link>
              ))}
              {extra > 0 && <span className={styles.calendarMore}>+{extra} more</span>}
            </div>
          );
        })}
      </div>

      <div className={styles.calendarDayPanel}>
        <div className={styles.calendarDayPanelHeader}>
          <h3 className={styles.calendarDayPanelTitle}>{selectedDayLabel}</h3>
          {canCreateEvents && (
            <Link
              href={`/schedule/new?date=${toDateInputValue(selectedDay)}`}
              className={`${styles.button} ${styles.buttonSecondary}`}
            >
              + New event
            </Link>
          )}
        </div>
        {selectedDayEvents.length === 0 && <p className={styles.helperText}>No events on this day.</p>}
        <ul className={styles.list}>
          {selectedDayEvents.map((event) => (
            <li key={event.id} className={styles.listRow}>
              <Link href={`/schedule/${event.id}`} className={styles.itemName}>
                {event.title}
              </Link>
              <div className={styles.tagRow}>
                {event.type && <span className={styles.pillMuted}>{eventTypeLabel(event.type)}</span>}
                <span className={styles.itemMeta}>
                  {new Date(event.start_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
