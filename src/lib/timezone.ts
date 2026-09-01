// Pure Intl.DateTimeFormat math — no server-only APIs — so this is safe to
// import from client components too (see EditSeriesForm, which needs it to
// show/edit a series' wall-clock time in the org's timezone rather than the
// admin's browser timezone).

export type WallTime = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function offsetFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function partsToWallTime(parts: Intl.DateTimeFormatPart[]): WallTime {
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

// How far ahead of UTC `timeZone`'s wall clock is, at this instant.
function getUtcOffsetMinutes(timeZone: string, date: Date): number {
  const wall = partsToWallTime(offsetFormatter(timeZone).formatToParts(date));
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  return Math.round((asUtc - date.getTime()) / 60_000);
}

// What time is it on the wall clock in `timeZone` at this real UTC instant?
export function utcToZonedWallTime(date: Date, timeZone: string): WallTime {
  return partsToWallTime(offsetFormatter(timeZone).formatToParts(date));
}

// The reverse: given a wall-clock time in `timeZone`, what real UTC instant
// is that? Two passes so the answer converges correctly right around a DST
// transition, where the offset used to compute it can itself change.
export function zonedWallTimeToUtc(wallTime: WallTime, timeZone: string): Date {
  const guess = Date.UTC(wallTime.year, wallTime.month - 1, wallTime.day, wallTime.hour, wallTime.minute, wallTime.second);
  let offset = getUtcOffsetMinutes(timeZone, new Date(guess));
  let utcMs = guess - offset * 60_000;
  offset = getUtcOffsetMinutes(timeZone, new Date(utcMs));
  utcMs = guess - offset * 60_000;
  return new Date(utcMs);
}
