import { redirect } from "next/navigation";
import Link from "next/link";
import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { describeRecurrenceRule } from "@/lib/recurrence";
import { formatEventTimeRange } from "@/lib/formatDateTime";
import { resolveTimeZone } from "@/lib/resolveTimeZone";
import { SeriesHeader } from "./SeriesHeader";
import { AddSeriesPositionForm } from "./AddSeriesPositionForm";
import { StandingAssignments, type StandingPosition } from "./StandingAssignments";
import { CancelledDates } from "./CancelledDates";
import styles from "@/styles/ui.module.css";

export default async function SeriesDetailPage({
  params,
}: {
  params: Promise<{ seriesId: string }>;
}) {
  const { seriesId } = await params;
  const { supabase, member, organizationName, isAdmin, isPlatformAdmin } = await requireMembership();

  if (!isAdmin) {
    redirect("/schedule");
  }

  const { data: series } = await supabase
    .from("event_series")
    .select("id, title, type, recurrence_rule, first_occurrence_at, duration_minutes, active, location_id, template_id")
    .eq("id", seriesId)
    .maybeSingle();

  if (!series) {
    return (
      <>
        <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
        <main className={styles.appMain}>
          <p className={styles.helperText}>Series not found.</p>
          <Link href="/schedule/series" className={styles.link}>
            ← Back to series
          </Link>
        </main>
      </>
    );
  }

  const [
    { data: generatedEvents },
    { data: locations },
    { data: eventTypes },
    { data: teams },
    { data: orgMembers },
    { data: teamRoleAssignments },
    { data: skips },
    timeZone,
  ] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, start_time, end_time")
      .eq("series_id", series.id)
      .order("start_time", { ascending: false })
      .limit(20),
    supabase.from("locations").select("id, name").eq("organization_id", member.organization_id),
    supabase.from("event_types").select("name").eq("organization_id", member.organization_id).order("name"),
    supabase.from("teams").select("id, name").eq("organization_id", member.organization_id),
    supabase
      .from("members")
      .select("id, name, status")
      .eq("organization_id", member.organization_id)
      .order("name"),
    supabase.from("role_assignments").select("member_id, scope_id").eq("scope_type", "team"),
    supabase
      .from("event_series_skips")
      .select("id, occurs_at")
      .eq("series_id", seriesId)
      .order("occurs_at", { ascending: false }),
    resolveTimeZone(supabase, member.organization_id, series.location_id),
  ]);

  // The recurring positions themselves, and who normally fills them. These
  // are what generation copies onto each new occurrence, so editing here is
  // what makes an assignment stick rather than decay as the horizon rolls.
  const { data: templatePositions } = series.template_id
    ? await supabase
        .from("template_positions")
        .select("id, title, team_id, slots")
        .eq("template_id", series.template_id)
        .order("start_offset_minutes")
    : { data: [] as { id: string; title: string; team_id: string | null; slots: number }[] };

  const templatePositionIds = (templatePositions ?? []).map((p) => p.id);
  const { data: standingRows } = templatePositionIds.length
    ? await supabase
        .from("template_position_assignments")
        .select("id, template_position_id, member_id")
        .in("template_position_id", templatePositionIds)
    : { data: [] as { id: string; template_position_id: string; member_id: string }[] };

  const memberById = new Map((orgMembers ?? []).map((m) => [m.id, m]));
  const teamNames = new Map((teams ?? []).map((t) => [t.id, t.name]));
  const memberIdsByTeam = new Map<string, Set<string>>();
  for (const row of (teamRoleAssignments ?? []) as { member_id: string; scope_id: string }[]) {
    const set = memberIdsByTeam.get(row.scope_id) ?? new Set<string>();
    set.add(row.member_id);
    memberIdsByTeam.set(row.scope_id, set);
  }

  const standingPositions: StandingPosition[] = (templatePositions ?? []).map((position) => ({
    id: position.id,
    title: position.title,
    slots: position.slots,
    teamName: position.team_id ? (teamNames.get(position.team_id) ?? "Unknown team") : null,
    // A position scoped to a team can only be filled from that team, matching
    // the eligibility rule the event page already applies per occurrence.
    candidates: (orgMembers ?? [])
      .filter((m) => !position.team_id || memberIdsByTeam.get(position.team_id)?.has(m.id))
      .map((m) => ({ id: m.id, name: m.name, pending: m.status === "pending" })),
    assigned: (standingRows ?? [])
      .filter((row) => row.template_position_id === position.id)
      .map((row) => ({
        assignmentId: row.id,
        memberId: row.member_id,
        name: memberById.get(row.member_id)?.name ?? "Unknown member",
      })),
  }));

  return (
    <>
      <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>{series.title}</h1>
          <p className={styles.subtitle}>
            {organizationName} · {describeRecurrenceRule(series.recurrence_rule)}
          </p>
        </div>

        <SeriesHeader
          series={series}
          eventTypes={(eventTypes ?? []).map((t) => t.name)}
          locations={locations ?? []}
          timeZone={timeZone}
        />

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Generated events</h2>
          </div>
          {(generatedEvents ?? []).length === 0 && (
            <p className={styles.helperText}>
              No events generated yet — try &quot;Generate upcoming events now&quot; above.
            </p>
          )}
          <ul className={styles.list}>
            {(generatedEvents ?? []).map((event) => (
              <li key={event.id} className={styles.listRow}>
                <Link href={`/schedule/${event.id}`} className={styles.itemName}>
                  {event.title}
                </Link>
                <p className={styles.itemMeta}>{formatEventTimeRange(event.start_time, event.end_time, timeZone)}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Who normally covers this</h2>
            <p className={styles.helperText}>
              People here are put on every upcoming occurrence — the ones already on the calendar and the ones
              generated months from now — so an assignment lasts until it&apos;s changed here. Removing someone
              takes them off every future occurrence too. Past events are never touched, and taking someone off a
              single event on the schedule only covers that week, leaving this list alone.
            </p>
          </div>
          <StandingAssignments positions={standingPositions} />
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Cancelled dates</h2>
            <p className={styles.helperText}>
              Occurrences someone deleted from the schedule. The series skips these when it generates. Restoring
              one brings the event back with its template positions and whoever is on the standing roster above —
              the assignments that were on the cancelled event itself don&apos;t return.
            </p>
          </div>
          <CancelledDates
            skips={(skips ?? []).map((skip) => ({
              id: skip.id,
              label: formatEventTimeRange(
                skip.occurs_at,
                new Date(new Date(skip.occurs_at).getTime() + series.duration_minutes * 60_000).toISOString(),
                timeZone,
              ),
              past: new Date(skip.occurs_at) < new Date(),
            }))}
          />
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Add a position</h2>
            <p className={styles.helperText}>
              Applies to every occurrence this series generates going forward.
              {series.template_id && (
                <>
                  {" "}
                  <Link href={`/schedule/templates/${series.template_id}`} className={styles.link}>
                    Manage this series&apos; existing positions
                  </Link>
                </>
              )}
            </p>
          </div>
          <AddSeriesPositionForm
            seriesId={series.id}
            seriesTitle={series.title}
            templateId={series.template_id}
            organizationId={member.organization_id}
            teams={teams ?? []}
            locations={locations ?? []}
          />
        </div>

        <Link href="/schedule/series" className={styles.link}>
          ← Back to series
        </Link>
      </main>
    </>
  );
}
