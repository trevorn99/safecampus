// Shared by every page that renders <EventCalendar> — one month back, a
// year forward, with a bit of padding either side so Prev/Next always have
// somewhere to go without a fresh fetch.
export function calendarWindow(now: Date = new Date()) {
  const todayIso = now.toISOString();
  const minMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const maxMonth = new Date(now.getFullYear(), now.getMonth() + 12, 1);
  const rangeEndExclusive = new Date(now.getFullYear(), now.getMonth() + 13, 1);
  return {
    todayIso,
    minMonthIso: minMonth.toISOString(),
    maxMonthIso: maxMonth.toISOString(),
    rangeStartIso: minMonth.toISOString(),
    rangeEndExclusiveIso: rangeEndExclusive.toISOString(),
  };
}
