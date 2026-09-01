// Builds and describes the small subset of RFC 5545 RRULE strings this app
// actually generates (weekly on N weekdays, or monthly on an ordinal
// weekday) — not a general-purpose RRULE formatter/parser. Expansion into
// concrete occurrence dates is handled separately, by the `rrule` library,
// in src/lib/eventSeries.ts.

export const WEEKDAYS = [
  { value: "SU", label: "Sunday" },
  { value: "MO", label: "Monday" },
  { value: "TU", label: "Tuesday" },
  { value: "WE", label: "Wednesday" },
  { value: "TH", label: "Thursday" },
  { value: "FR", label: "Friday" },
  { value: "SA", label: "Saturday" },
] as const;

export const ORDINALS = [
  { value: "1", label: "1st" },
  { value: "2", label: "2nd" },
  { value: "3", label: "3rd" },
  { value: "4", label: "4th" },
  { value: "-1", label: "last" },
] as const;

const WEEKDAY_NAME: Record<string, string> = Object.fromEntries(WEEKDAYS.map((w) => [w.value, w.label]));
const ORDINAL_NAME: Record<string, string> = Object.fromEntries(ORDINALS.map((o) => [o.value, o.label]));

export function buildWeeklyRule(interval: number, days: string[]): string {
  return `FREQ=WEEKLY;INTERVAL=${Math.max(1, interval)};BYDAY=${days.join(",")}`;
}

export function buildMonthlyRule(ordinal: string, day: string): string {
  return `FREQ=MONTHLY;BYDAY=${ordinal}${day}`;
}

export type ParsedRecurrenceRule =
  | { freq: "WEEKLY"; interval: number; days: string[] }
  | { freq: "MONTHLY"; ordinal: string; day: string };

// Inverse of buildWeeklyRule/buildMonthlyRule, for pre-filling an edit form
// from a stored rule. Returns null for anything outside that subset.
export function parseRecurrenceRule(rule: string): ParsedRecurrenceRule | null {
  const parts = Object.fromEntries(
    rule.split(";").map((part) => part.split("=") as [string, string]),
  );

  if (parts.FREQ === "WEEKLY") {
    return {
      freq: "WEEKLY",
      interval: parts.INTERVAL ? Number(parts.INTERVAL) : 1,
      days: (parts.BYDAY ?? "").split(",").filter(Boolean),
    };
  }

  if (parts.FREQ === "MONTHLY") {
    const match = (parts.BYDAY ?? "").match(/^(-?\d+)([A-Z]{2})$/);
    if (match) {
      return { freq: "MONTHLY", ordinal: match[1], day: match[2] };
    }
  }

  return null;
}

export function describeRecurrenceRule(rule: string): string {
  const parts = Object.fromEntries(
    rule.split(";").map((part) => part.split("=") as [string, string]),
  );
  const freq = parts.FREQ;
  const interval = parts.INTERVAL ? Number(parts.INTERVAL) : 1;
  const byday = parts.BYDAY ?? "";

  if (freq === "WEEKLY") {
    const days = byday
      .split(",")
      .filter(Boolean)
      .map((day) => WEEKDAY_NAME[day] ?? day)
      .join(", ");
    return interval > 1 ? `Every ${interval} weeks on ${days}` : `Every week on ${days}`;
  }

  if (freq === "MONTHLY") {
    const match = byday.match(/^(-?\d+)([A-Z]{2})$/);
    if (match) {
      const [, ordinal, day] = match;
      return `Every month on the ${ORDINAL_NAME[ordinal] ?? ordinal} ${WEEKDAY_NAME[day] ?? day}`;
    }
  }

  return rule;
}
