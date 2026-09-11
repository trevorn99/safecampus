// event_templates.default_start_time is a bare "HH:MM:SS" clock time with no
// date and no zone, and the event forms work in "YYYY-MM-DDTHH:MM" wall-time
// strings for the location's timezone. These convert between the two without
// any timezone maths: the date half of the form value is already the right
// local date, so applying a template time only ever replaces the time half.

export function toTimeInputValue(dbTime: string | null | undefined): string {
  return dbTime ? dbTime.slice(0, 5) : "";
}

/** "09:00" plus 90 minutes -> "10:30", rolling past midnight if it has to. */
export function addMinutesToTimeInput(time: string, minutes: number): string {
  const [hour, minute] = time.split(":").map(Number);
  const total = (((hour * 60 + minute + minutes) % 1440) + 1440) % 1440;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** Minutes from one clock time to another, treating an earlier end as overnight. */
export function minutesBetweenTimeInputs(start: string, end: string): number {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const diff = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  return diff > 0 ? diff : diff + 1440;
}

/** Swaps the time half of a "YYYY-MM-DDTHH:MM" value, keeping its date. */
export function withTime(dateTimeValue: string, time: string, fallbackDate: string): string {
  const date = dateTimeValue.split("T")[0] || fallbackDate;
  return `${date}T${time}`;
}

export function todayDateInput(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
