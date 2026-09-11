import type { SupabaseClient } from "@supabase/supabase-js";

// Every occurrence of one recurring position that hasn't happened yet.
// Keyed on the position's own start_time rather than its event's: a position
// can sit hours off the event start, and "future" should mean the shift
// itself hasn't begun.
async function futurePositionIds(
  supabase: SupabaseClient,
  templatePositionId: string,
  excludePositionId?: string,
): Promise<string[]> {
  const query = supabase
    .from("event_positions")
    .select("id")
    .eq("template_position_id", templatePositionId)
    .gte("start_time", new Date().toISOString());
  const { data } = excludePositionId ? await query.neq("id", excludePositionId) : await query;
  return (data ?? []).map((position) => position.id);
}

// Puts a member on every future occurrence of a recurring position that's
// already been generated. The standing roster
// (template_position_assignments) covers occurrences that don't exist yet;
// this covers the ones that do. Both are needed — neither alone means "on
// this position from now on".
export async function assignToFutureOccurrences(
  supabase: SupabaseClient,
  memberId: string,
  templatePositionId: string,
  excludePositionId?: string,
): Promise<void> {
  const positionIds = await futurePositionIds(supabase, templatePositionId, excludePositionId);
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

// The mirror of the above, for when someone comes off the standing roster.
// Without it, removing a person would stop them being added to occurrences
// generated later while leaving them on every one already created — up to a
// year of events they're no longer supposed to be covering.
export async function unassignFromFutureOccurrences(
  supabase: SupabaseClient,
  memberId: string,
  templatePositionId: string,
): Promise<void> {
  const positionIds = await futurePositionIds(supabase, templatePositionId);
  if (positionIds.length === 0) return;

  await supabase.from("assignments").delete().eq("member_id", memberId).in("event_position_id", positionIds);
}

// Used by the "also assign to every future event in this series" checkbox on
// an individual event. Records the standing roster entry first so the
// assignment also reaches occurrences that don't exist yet, then fans out
// across the ones that do.
export async function assignAcrossSeries(
  supabase: SupabaseClient,
  memberId: string,
  seriesId: string,
  templatePositionId: string,
  excludePositionId: string,
): Promise<void> {
  await supabase
    .from("template_position_assignments")
    .upsert(
      { template_position_id: templatePositionId, member_id: memberId },
      { onConflict: "template_position_id,member_id" },
    );

  await assignToFutureOccurrences(supabase, memberId, templatePositionId, excludePositionId);
}
