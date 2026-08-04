// Shared display formatting for event start/end pairs — used anywhere an
// event's time is listed (schedule list, event detail header, series
// occurrences). End time collapses to just a time-of-day when it falls on
// the same calendar day as the start, since that's true almost always for a
// shift; otherwise it spells out the full end date too.
export function formatEventTimeRange(startIso: string, endIso: string | null): string {
  const start = new Date(startIso);
  const startLabel = start.toLocaleString();
  if (!endIso) return startLabel;

  const end = new Date(endIso);
  const sameDay =
    start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth() && start.getDate() === end.getDate();
  const endLabel = sameDay
    ? end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : end.toLocaleString();

  return `${startLabel} – ${endLabel}`;
}
