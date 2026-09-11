import type { SupabaseClient } from "@supabase/supabase-js";

// Every occurrence of one recurring position that hasn't happened yet, with
// the slot count needed to decide whether there's still room. Keyed on the
// position's own start_time rather than its event's: a position can sit hours
// off the event start, and "future" should mean the shift itself hasn't begun.
async function futurePositions(
  supabase: SupabaseClient,
  templatePositionId: string,
  excludePositionId?: string,
): Promise<{ id: string; slots: number }[]> {
  const query = supabase
    .from("event_positions")
    .select("id, slots")
    .eq("template_position_id", templatePositionId)
    .gte("start_time", new Date().toISOString());
  const { data } = excludePositionId ? await query.neq("id", excludePositionId) : await query;
  return data ?? [];
}

// Puts a member on every future occurrence of a recurring position that's
// already been generated. The standing roster
// (template_position_assignments) covers occurrences that don't exist yet;
// this covers the ones that do. Both are needed — neither alone means "on
// this position from now on".
//
// Skips any occurrence already at capacity rather than overfilling it. That
// keeps slots meaningful without a database constraint that would abort a
// year-long fan-out partway through: an occurrence somebody else already
// filled is simply left alone, and the caller is told how many were skipped.
export async function assignToFutureOccurrences(
  supabase: SupabaseClient,
  memberId: string,
  templatePositionId: string,
  excludePositionId?: string,
): Promise<{ assigned: number; skippedFull: number }> {
  const positions = await futurePositions(supabase, templatePositionId, excludePositionId);
  if (positions.length === 0) return { assigned: 0, skippedFull: 0 };

  const positionIds = positions.map((position) => position.id);
  const { data: existing } = await supabase
    .from("assignments")
    .select("event_position_id, member_id, status")
    .in("event_position_id", positionIds);

  // Declined assignments don't hold a slot, matching how the event page
  // counts capacity.
  const filledByPosition = new Map<string, number>();
  const alreadyAssigned = new Set<string>();
  for (const row of existing ?? []) {
    if (row.member_id === memberId) alreadyAssigned.add(row.event_position_id);
    if (row.status !== "declined") {
      filledByPosition.set(row.event_position_id, (filledByPosition.get(row.event_position_id) ?? 0) + 1);
    }
  }

  let skippedFull = 0;
  const toInsert: { event_position_id: string; member_id: string }[] = [];
  for (const position of positions) {
    if (alreadyAssigned.has(position.id)) continue;
    if ((filledByPosition.get(position.id) ?? 0) >= position.slots) {
      skippedFull += 1;
      continue;
    }
    toInsert.push({ event_position_id: position.id, member_id: memberId });
  }

  if (toInsert.length > 0) {
    // ignoreDuplicates so a concurrent assignment of the same person doesn't
    // fail the whole batch against the unique index — the row it would have
    // written already exists, which is the outcome we wanted anyway.
    await supabase
      .from("assignments")
      .upsert(toInsert, { onConflict: "event_position_id,member_id", ignoreDuplicates: true });
  }

  return { assigned: toInsert.length, skippedFull };
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
  const positionIds = (await futurePositions(supabase, templatePositionId)).map((position) => position.id);
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
