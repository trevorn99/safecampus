import "server-only";
import { rrulestr } from "rrule";
import type { SupabaseClient } from "@supabase/supabase-js";

// How far ahead a single generation pass creates events. The daily cron
// re-runs this for every active series, so occurrences just beyond this
// horizon get created on a later run rather than all at once.
const GENERATION_HORIZON_DAYS = 60;

// Known limitation: occurrences are computed as fixed UTC instants from
// first_occurrence_at, not as "same local wall-clock time" in the org's own
// timezone. A series that spans a DST transition will drift by an hour in
// local time rather than holding its local start time steady. Fixing this
// properly needs a timezone-aware recurrence library and isn't done here.
function toRRuleUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export type EventSeriesRow = {
  id: string;
  organization_id: string;
  location_id: string | null;
  template_id: string | null;
  title: string;
  recurrence_rule: string;
  first_occurrence_at: string;
};

export async function generateSeriesOccurrences(
  supabase: SupabaseClient,
  series: EventSeriesRow,
): Promise<{ created: number }> {
  const dtstart = new Date(series.first_occurrence_at);
  const rule = rrulestr(`DTSTART:${toRRuleUtc(dtstart)}\nRRULE:${series.recurrence_rule}`);

  const windowStart = new Date();
  const windowEnd = new Date(Date.now() + GENERATION_HORIZON_DAYS * 24 * 60 * 60 * 1000);
  const occurrences = rule.between(windowStart, windowEnd, true);
  if (occurrences.length === 0) return { created: 0 };

  const { data: existingEvents } = await supabase
    .from("events")
    .select("start_time")
    .eq("series_id", series.id)
    .gte("start_time", windowStart.toISOString());
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
