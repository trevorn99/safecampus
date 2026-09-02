import type { SupabaseClient } from "@supabase/supabase-js";

// Assigns memberId to every other future occurrence of the same
// template-derived position within a series — used when an admin or a
// volunteer opts to sign up for a recurring position once instead of
// per-event. Only future events are touched (matches the convention used
// elsewhere for series-wide edits — past occurrences are historical).
// Silently skips positions the member is already assigned to.
export async function assignAcrossSeries(
  supabase: SupabaseClient,
  memberId: string,
  seriesId: string,
  templatePositionId: string,
  excludePositionId: string,
): Promise<void> {
  const { data: seriesEvents } = await supabase
    .from("events")
    .select("id")
    .eq("series_id", seriesId)
    .gte("start_time", new Date().toISOString());
  const eventIds = (seriesEvents ?? []).map((e) => e.id);
  if (eventIds.length === 0) return;

  const { data: siblingPositions } = await supabase
    .from("event_positions")
    .select("id")
    .eq("template_position_id", templatePositionId)
    .in("event_id", eventIds)
    .neq("id", excludePositionId);
  const positionIds = (siblingPositions ?? []).map((p) => p.id);
  if (positionIds.length === 0) return;

  const { data: existing } = await supabase
    .from("assignments")
    .select("event_position_id")
    .eq("member_id", memberId)
    .in("event_position_id", positionIds);
  const alreadyAssigned = new Set((existing ?? []).map((a) => a.event_position_id));

  const toInsert = positionIds
    .filter((id) => !alreadyAssigned.has(id))
    .map((event_position_id) => ({ event_position_id, member_id: memberId }));
  if (toInsert.length > 0) {
    await supabase.from("assignments").insert(toInsert);
  }
}
