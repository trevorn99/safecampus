import { utcToZonedWallTime } from "./timezone";

// Shared display formatting for event start/end pairs — used anywhere an
// event's time is listed (schedule list, event detail header, series
// occurrences). End time collapses to just a time-of-day when it falls on
// the same calendar day as the start, since that's true almost always for a
// shift; otherwise it spells out the full end date too.
//
// timeZone is required, not defaulted, so every call site has to think
// about which org/location timezone applies — a silent browser/server
// default here is exactly what caused event times to display hours off
// from what was actually scheduled.
export function formatEventTimeRange(startIso: string, endIso: string | null, timeZone: string): string {
  const start = new Date(startIso);
  const startLabel = start.toLocaleString(undefined, { timeZone });
  if (!endIso) return startLabel;

  const end = new Date(endIso);
  const startWall = utcToZonedWallTime(start, timeZone);
  const endWall = utcToZonedWallTime(end, timeZone);
  const sameDay = startWall.year === endWall.year && startWall.month === endWall.month && startWall.day === endWall.day;
  const endLabel = sameDay
    ? end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone })
    : end.toLocaleString(undefined, { timeZone });

  return `${startLabel} – ${endLabel}`;
}
