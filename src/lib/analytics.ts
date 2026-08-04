import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EVENT_TYPES, EVENT_TYPE_LABEL } from "@/lib/eventTypes";

export type EventTypeCount = { type: string; label: string; count: number };

// RLS already scopes every table below to the caller's own org (or, for an
// org admin, their org specifically) — see events/event_positions/
// assignments/certifications policies — so these queries filter by
// organization_id only where the table carries it directly, same pattern
// already used on the certifications and event detail pages.
export async function getEventTypeBreakdown(
  supabase: SupabaseClient,
  organizationId: string,
  sinceIso: string,
): Promise<EventTypeCount[]> {
  const { data } = await supabase
    .from("events")
    .select("type")
    .eq("organization_id", organizationId)
    .gte("start_time", sinceIso);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.type, (counts.get(row.type) ?? 0) + 1);
  }
  return EVENT_TYPES.map((type) => ({ type, label: EVENT_TYPE_LABEL[type], count: counts.get(type) ?? 0 }));
}

export type WeeklyFillRate = { weekStart: string; filled: number; total: number; rate: number };

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

// Fill rate = assigned slots / total slots across every position on events
// starting in that week — capped per position at its own slot count, so an
// over-assigned position can't push a week over 100%.
export async function getWeeklyFillRate(
  supabase: SupabaseClient,
  organizationId: string,
  weeks: number,
): Promise<WeeklyFillRate[]> {
  const now = new Date();
  const rangeStart = startOfWeek(new Date(now.getTime() - (weeks - 1) * 7 * 24 * 60 * 60 * 1000));

  const { data: events } = await supabase
    .from("events")
    .select("id, start_time")
    .eq("organization_id", organizationId)
    .gte("start_time", rangeStart.toISOString());

  const eventWeek = new Map<string, string>();
  for (const event of events ?? []) {
    eventWeek.set(event.id, startOfWeek(new Date(event.start_time)).toISOString());
  }
  const eventIds = [...eventWeek.keys()];

  const buckets = new Map<string, { filled: number; total: number }>();
  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date(rangeStart.getTime() + i * 7 * 24 * 60 * 60 * 1000).toISOString();
    buckets.set(weekStart, { filled: 0, total: 0 });
  }

  if (eventIds.length > 0) {
    const { data: positions } = await supabase
      .from("event_positions")
      .select("id, event_id, slots")
      .in("event_id", eventIds);

    const positionIds = (positions ?? []).map((p) => p.id);
    const { data: assignments } =
      positionIds.length > 0
        ? await supabase.from("assignments").select("event_position_id").in("event_position_id", positionIds)
        : { data: [] as { event_position_id: string }[] };

    const filledByPosition = new Map<string, number>();
    for (const a of assignments ?? []) {
      filledByPosition.set(a.event_position_id, (filledByPosition.get(a.event_position_id) ?? 0) + 1);
    }

    for (const position of positions ?? []) {
      const week = eventWeek.get(position.event_id);
      if (!week || !buckets.has(week)) continue;
      const bucket = buckets.get(week)!;
      bucket.total += position.slots;
      bucket.filled += Math.min(filledByPosition.get(position.id) ?? 0, position.slots);
    }
  }

  return [...buckets.entries()].map(([weekStart, { filled, total }]) => ({
    weekStart,
    filled,
    total,
    rate: total > 0 ? filled / total : 0,
  }));
}

export type ExpiringCertification = { memberName: string; type: string; expiresAt: string };

export async function getExpiringCertifications(
  supabase: SupabaseClient,
  organizationId: string,
  daysAhead: number,
): Promise<ExpiringCertification[]> {
  const today = new Date();
  const horizon = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const [{ data: certs }, { data: members }] = await Promise.all([
    supabase
      .from("certifications")
      .select("type, expires_at, member_id")
      .not("expires_at", "is", null)
      .gte("expires_at", today.toISOString().slice(0, 10))
      .lte("expires_at", horizon.toISOString().slice(0, 10))
      .order("expires_at", { ascending: true }),
    supabase.from("members").select("id, name").eq("organization_id", organizationId),
  ]);

  const nameById = new Map((members ?? []).map((m) => [m.id, m.name]));
  return (certs ?? [])
    .filter((c) => nameById.has(c.member_id))
    .map((c) => ({ memberName: nameById.get(c.member_id)!, type: c.type, expiresAt: c.expires_at as string }));
}

export type AttendanceStat = { totalRecords: number; uniqueMembers: number };

export async function getAttendanceStat(
  supabase: SupabaseClient,
  organizationId: string,
  sinceIso: string,
): Promise<AttendanceStat> {
  const { data: events } = await supabase
    .from("events")
    .select("id")
    .eq("organization_id", organizationId)
    .gte("start_time", sinceIso);
  const eventIds = (events ?? []).map((e) => e.id);
  if (eventIds.length === 0) return { totalRecords: 0, uniqueMembers: 0 };

  const { data: attendance } = await supabase.from("attendance").select("member_id").in("event_id", eventIds);
  const rows = attendance ?? [];
  return { totalRecords: rows.length, uniqueMembers: new Set(rows.map((r) => r.member_id)).size };
}
