import "server-only";
import { rrulestr } from "rrule";
import type { SupabaseClient } from "@supabase/supabase-js";
import { utcToZonedWallTime, zonedWallTimeToUtc, type WallTime } from "@/lib/timezone";

// How far ahead a single generation pass creates events. The daily cron
// re-runs this for every active series, so occurrences just beyond this
// horizon get created on a later run rather than all at once.
const GENERATION_HORIZON_DAYS = 60;

// rrule operates on "floating" dates — plain calendar/clock component
// containers with no real timezone meaning (see its own README). That's
// exactly what we want: recurrence should hold a fixed *wall-clock* time
// (e.g. "10:00 AM every Sunday"), not a fixed UTC instant, so a series
// doesn't drift by an hour across a DST transition. The approach: convert
// real UTC instants to/from the org's wall-clock time via src/lib/timezone.ts,
// and only ever hand rrule "floating" dates built from those components.

function wallTimeToFloatingDate(wallTime: WallTime): Date {
  return new Date(
    Date.UTC(wallTime.year, wallTime.month - 1, wallTime.day, wallTime.hour, wallTime.minute, wallTime.second),
  );
}

function floatingDateToWallTime(date: Date): WallTime {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
  };
}

function toRRuleDtStart(floatingDate: Date): string {
  return floatingDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export type EventSeriesRow = {
  id: string;
  organization_id: string;
  location_id: string | null;
  template_id: string | null;
  title: string;
  type: string;
  recurrence_rule: string;
  first_occurrence_at: string;
};

async function resolveTimeZone(
  supabase: SupabaseClient,
  organizationId: string,
  locationId: string | null,
): Promise<string> {
  if (locationId) {
    const { data: location } = await supabase
      .from("locations")
      .select("timezone")
      .eq("id", locationId)
      .maybeSingle();
    if (location?.timezone) return location.timezone;
  }
  const { data: organization } = await supabase
    .from("organizations")
    .select("timezone")
    .eq("id", organizationId)
    .single();
  return organization?.timezone ?? "UTC";
}

export async function generateSeriesOccurrences(
  supabase: SupabaseClient,
  series: EventSeriesRow,
): Promise<{ created: number }> {
  const timeZone = await resolveTimeZone(supabase, series.organization_id, series.location_id);

  const anchorWall = utcToZonedWallTime(new Date(series.first_occurrence_at), timeZone);
  const rule = rrulestr(`DTSTART:${toRRuleDtStart(wallTimeToFloatingDate(anchorWall))}\nRRULE:${series.recurrence_rule}`);

  const now = new Date();
  const horizonEnd = new Date(Date.now() + GENERATION_HORIZON_DAYS * 24 * 60 * 60 * 1000);
  const windowStartFloating = wallTimeToFloatingDate(utcToZonedWallTime(now, timeZone));
  const windowEndFloating = wallTimeToFloatingDate(utcToZonedWallTime(horizonEnd, timeZone));

  const floatingOccurrences = rule.between(windowStartFloating, windowEndFloating, true);
  if (floatingOccurrences.length === 0) return { created: 0 };

  const occurrences = floatingOccurrences.map((floating) =>
    zonedWallTimeToUtc(floatingDateToWallTime(floating), timeZone),
  );

  const { data: existingEvents } = await supabase
    .from("events")
    .select("start_time")
    .eq("series_id", series.id)
    .gte("start_time", now.toISOString());
  const existingTimes = new Set((existingEvents ?? []).map((e) => new Date(e.start_time).getTime()));
  const missing = occurrences.filter((date) => !existingTimes.has(date.getTime()));
  if (missing.length === 0) return { created: 0 };

  let templatePositions: Array<{
    team_id: string | null;
    title: string;
    location_id: string | null;
    start_offset_minutes: number;
    end_offset_minutes: number | null;
    slots: number;
  }> = [];
  if (series.template_id) {
    const { data } = await supabase
      .from("template_positions")
      .select("team_id, title, location_id, start_offset_minutes, end_offset_minutes, slots")
      .eq("template_id", series.template_id);
    templatePositions = data ?? [];
  }

  let created = 0;
  for (const occurrence of missing) {
    const { data: newEvent, error } = await supabase
      .from("events")
      .insert({
        organization_id: series.organization_id,
        location_id: series.location_id,
        title: series.title,
        type: series.type,
        start_time: occurrence.toISOString(),
        series_id: series.id,
        template_id: series.template_id,
      })
      .select("id")
      .single();
    if (error || !newEvent) continue;
    created += 1;

    if (templatePositions.length > 0) {
      const startMs = occurrence.getTime();
      const positions = templatePositions.map((tp) => ({
        event_id: newEvent.id,
        team_id: tp.team_id,
        title: tp.title,
        location_id: tp.location_id,
        start_time: new Date(startMs + tp.start_offset_minutes * 60_000).toISOString(),
        end_time:
          tp.end_offset_minutes != null
            ? new Date(startMs + tp.end_offset_minutes * 60_000).toISOString()
            : null,
        slots: tp.slots,
      }));
      await supabase.from("event_positions").insert(positions);
    }
  }

  return { created };
}
