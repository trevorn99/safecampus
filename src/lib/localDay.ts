import "server-only";
import { utcToZonedWallTime } from "@/lib/timezone";

// Which local calendar day an instant falls on, as a comparable number.
//
// Everything scheduled here is calendar-day based rather than exact-hour
// based: "three days before" means three sleeps, not 72 hours, so a 9pm event
// and a 6am one on the same date are handled together. Comparing day numbers
// in the organization's own timezone is what makes that true regardless of
// where the server runs.
export function localDayNumber(date: Date, timeZone: string): number {
  const wall = utcToZonedWallTime(date, timeZone);
  return Math.floor(Date.UTC(wall.year, wall.month - 1, wall.day) / 86_400_000);
}

export function formatLocalDateTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
