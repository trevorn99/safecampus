import Link from "next/link";
import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { AssignmentStatusButtons } from "./AssignmentStatusButtons";
import { EventCalendar } from "@/components/EventCalendar";
import { calendarWindow } from "@/lib/calendarWindow";
import { resolveTimeZone } from "@/lib/resolveTimeZone";
import { formatEventTimeRange } from "@/lib/formatDateTime";
import styles from "@/styles/ui.module.css";

type MyAssignment = {
  id: string;
  status: string;
  event_positions: {
    id: string;
    title: string;
    start_time: string;
    end_time: string | null;
    events: { id: string; title: string } | { id: string; title: string }[] | null;
  } | null;
};

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export default async function SchedulePage() {
  const { supabase, member, organizationName, isAdmin, isPlatformAdmin } = await requireMembership();

  const { todayIso, minMonthIso, maxMonthIso, rangeStartIso, rangeEndExclusiveIso } = calendarWindow();

  const [{ data: events }, { data: myAssignments }, timeZone] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, start_time, end_time, type")
      .eq("organization_id", member.organization_id)
      .gte("start_time", rangeStartIso)
      .lt("start_time", rangeEndExclusiveIso)
      .order("start_time"),
    // Bounded at the database rather than filtered afterwards. This fetched
    // every assignment the member had ever held and threw away the past ones
    // in JS — which was fine when a series generated two months ahead, and
    // isn't now that one standing roster entry on a weekly series is fifty-two
    // rows.
    supabase
      .from("assignments")
      .select("id, status, event_positions!inner(id, title, start_time, events(id, title))")
      .eq("member_id", member.id)
      .gte("event_positions.start_time", new Date().toISOString())
      .returns<MyAssignment[]>(),
    resolveTimeZone(supabase, member.organization_id, null),
  ]);

  const upcomingAssignments = (myAssignments ?? [])
    .filter((a) => a.event_positions)
    .sort((a, b) => (a.event_positions!.start_time > b.event_positions!.start_time ? 1 : -1));

  // A year of a weekly commitment is not a list anyone reads. Showing the
  // next few and counting the rest keeps the page about what's coming up.
  const VISIBLE_ASSIGNMENTS = 8;
  const visibleAssignments = upcomingAssignments.slice(0, VISIBLE_ASSIGNMENTS);
  const hiddenAssignmentCount = upcomingAssignments.length - visibleAssignments.length;

  const assignedEventIds = [
    ...new Set(
      upcomingAssignments
        .map((a) => firstOf(a.event_positions?.events)?.id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  return (
    <>
      <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>Schedule</h1>
          <p className={styles.subtitle}>{organizationName}</p>
        </div>

        {upcomingAssignments.length > 0 && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Your upcoming assignments</h2>
              <p className={styles.helperText}>
                {hiddenAssignmentCount > 0
                  ? `The next ${visibleAssignments.length} of ${upcomingAssignments.length} — the rest are further out on the calendar below.`
                  : `${upcomingAssignments.length} coming up.`}
              </p>
            </div>
            <ul className={styles.list}>
              {visibleAssignments.map((assignment) => {
                const position = assignment.event_positions!;
                const eventTitle = firstOf(position.events)?.title ?? "Event";
                return (
                  <li key={assignment.id} className={styles.listRow}>
                    <div>
                      <p className={styles.itemName}>
                        {position.title} · {eventTitle}
                      </p>
                      <p className={styles.itemMeta}>{formatEventTimeRange(position.start_time, null, timeZone)}</p>
                    </div>
                    <AssignmentStatusButtons assignmentId={assignment.id} status={assignment.status} />
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {isAdmin && (
          <div className={styles.actions}>
            <Link href="/schedule/new" className={`${styles.button} ${styles.buttonPrimary}`}>
              New event
            </Link>
          </div>
        )}

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Events</h2>
          </div>
          <EventCalendar
            events={events ?? []}
            today={todayIso}
            minMonth={minMonthIso}
            maxMonth={maxMonthIso}
            timeZone={timeZone}
            assignedEventIds={assignedEventIds}
            canCreateEvents={isAdmin}
          />
        </div>
      </main>
    </>
  );
}
