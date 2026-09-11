import "server-only";
import { rrulestr } from "rrule";
import type { SupabaseClient } from "@supabase/supabase-js";
import { utcToZonedWallTime, zonedWallTimeToUtc, type WallTime } from "@/lib/timezone";
import { resolveTimeZone } from "@/lib/resolveTimeZone";

// How far ahead a single generation pass creates events. The daily cron
// re-runs this for every active series, so the window rolls forward a day at
// a time and a series never runs out — a year is always visible without
// anyone renewing anything by hand.
//
// A year of a daily series is 365 events plus their positions, which is why
// the inserts below are batched rather than issued one occurrence at a time.
const GENERATION_HORIZON_DAYS = 365;

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
  duration_minutes: number;
};

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

  // Occurrences someone cancelled. Without this they read as missing and get
  // recreated on the next run — deleting one Sunday would undo itself
  // overnight.
  const { data: skips } = await supabase
    .from("event_series_skips")
    .select("occurs_at")
    .eq("series_id", series.id);
  const skippedTimes = new Set((skips ?? []).map((skip) => new Date(skip.occurs_at).getTime()));

  const missing = occurrences.filter(
    (date) => !existingTimes.has(date.getTime()) && !skippedTimes.has(date.getTime()),
  );
  if (missing.length === 0) return { created: 0 };

  let templatePositions: Array<{
    id: string;
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
      .select("id, team_id, title, location_id, start_offset_minutes, end_offset_minutes, slots")
      .eq("template_id", series.template_id);
    templatePositions = data ?? [];
  }

  // One insert for every occurrence, then one for all their positions —
  // rather than two round trips per occurrence. At a 60-day horizon the
  // per-occurrence version was merely wasteful; at a year it would run for
  // hundreds of round trips per series and time the function out.
  const { data: insertedEvents, error: insertError } = await supabase
    .from("events")
    .insert(
      missing.map((occurrence) => ({
        organization_id: series.organization_id,
        location_id: series.location_id,
        title: series.title,
        type: series.type,
        start_time: occurrence.toISOString(),
        end_time: new Date(occurrence.getTime() + series.duration_minutes * 60_000).toISOString(),
        series_id: series.id,
        template_id: series.template_id,
      })),
    )
    .select("id, start_time");

  // Swallowed, not thrown: the cron walks every active series in one pass,
  // and one organization's bad series shouldn't stop everyone else's from
  // being generated.
  if (insertError || !insertedEvents) return { created: 0 };

  if (templatePositions.length > 0) {
    const { data: insertedPositions } = await supabase.from("event_positions").insert(
      insertedEvents.flatMap((event) => {
        const startMs = new Date(event.start_time).getTime();
        return templatePositions.map((tp) => ({
          event_id: event.id,
          // The link back to the series' position. Without it the
          // "apply to every future event in this series" paths can't find an
          // occurrence at all: assignAcrossSeries matches siblings on this
          // column, and both assign forms hide their series checkbox when
          // it's null. AddSeriesPositionForm has always set it; generated
          // occurrences never did, so the feature only worked on events that
          // already existed when a position was added.
          template_position_id: tp.id,
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
      }),
    ).select("id, template_position_id");

    // Standing assignments — the roster for the recurring position itself —
    // are copied onto each new occurrence, so people stay on a position as
    // the horizon rolls forward instead of every generated event arriving
    // unfilled. Someone removed from one occurrence stays removed only
    // there; this is what an admin changes to stop it recurring.
    const { data: standing } = await supabase
      .from("template_position_assignments")
      .select("template_position_id, member_id")
      .in(
        "template_position_id",
        templatePositions.map((tp) => tp.id),
      );

    if (standing && standing.length > 0 && insertedPositions && insertedPositions.length > 0) {
      const membersByTemplatePosition = new Map<string, string[]>();
      for (const row of standing) {
        const list = membersByTemplatePosition.get(row.template_position_id) ?? [];
        list.push(row.member_id);
        membersByTemplatePosition.set(row.template_position_id, list);
      }

      const slotsByTemplatePosition = new Map(templatePositions.map((tp) => [tp.id, tp.slots]));
      const assignmentRows = insertedPositions.flatMap((position) => {
        const key = position.template_position_id ?? "";
        // A standing roster longer than the position's slots would otherwise
        // overfill every occurrence it seeds. Capped here rather than
        // rejected, so a roster kept deliberately deep (cover for absences)
        // still works — the first `slots` are placed and the rest aren't.
        const members = (membersByTemplatePosition.get(key) ?? []).slice(0, slotsByTemplatePosition.get(key) ?? 1);
        return members.map((member_id) => ({ event_position_id: position.id, member_id }));
      });
      if (assignmentRows.length > 0) {
        await supabase.from("assignments").insert(assignmentRows);
      }
    }
  }

  const created = insertedEvents.length;
  return { created };
}
