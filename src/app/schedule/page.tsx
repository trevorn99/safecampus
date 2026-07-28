import Link from "next/link";
import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { AssignmentStatusButtons } from "./AssignmentStatusButtons";
import styles from "@/styles/ui.module.css";

const TYPE_LABEL: Record<string, string> = {
  service: "Service",
  drill: "Drill",
  meeting: "Meeting",
};

// Pulled out of the component body — react-hooks/purity flags impure calls
// (Date construction with no args) made directly during render.
function nowIso(): string {
  return new Date().toISOString();
}

type MyAssignment = {
  id: string;
  status: string;
  event_positions: {
    id: string;
    title: string;
    start_time: string;
    events: { title: string } | { title: string }[] | null;
  } | null;
};

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export default async function SchedulePage() {
  const { supabase, member, organizationName, isAdmin, isPlatformAdmin } = await requireMembership();

  const [{ data: events }, { data: locations }, { data: myAssignments }] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, start_time, type, location_id")
      .eq("organization_id", member.organization_id)
      .gte("start_time", nowIso())
      .order("start_time", { ascending: true })
      .limit(100),
    supabase.from("locations").select("id, name").eq("organization_id", member.organization_id),
    supabase
      .from("assignments")
      .select("id, status, event_positions(id, title, start_time, events(title))")
      .eq("member_id", member.id)
      .returns<MyAssignment[]>(),
  ]);

  const locationName = new Map((locations ?? []).map((l) => [l.id, l.name]));

  const upcomingAssignments = (myAssignments ?? [])
    .filter((a) => a.event_positions && new Date(a.event_positions.start_time) >= new Date())
    .sort((a, b) => (a.event_positions!.start_time > b.event_positions!.start_time ? 1 : -1));

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
            </div>
            <ul className={styles.list}>
              {upcomingAssignments.map((assignment) => {
                const position = assignment.event_positions!;
                const eventTitle = firstOf(position.events)?.title ?? "Event";
                return (
                  <li key={assignment.id} className={styles.listRow}>
                    <div>
                      <p className={styles.itemName}>
                        {position.title} · {eventTitle}
                      </p>
                      <p className={styles.itemMeta}>{new Date(position.start_time).toLocaleString()}</p>
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
            <Link href="/schedule/templates" className={`${styles.button} ${styles.buttonSecondary}`}>
              Manage templates
            </Link>
            <Link href="/schedule/series" className={`${styles.button} ${styles.buttonSecondary}`}>
              Recurring series
            </Link>
            <Link href="/schedule/integrations" className={`${styles.button} ${styles.buttonSecondary}`}>
              Integrations
            </Link>
          </div>
        )}

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Upcoming events</h2>
          </div>
          {(events ?? []).length === 0 && <p className={styles.helperText}>No upcoming events yet.</p>}
          <ul className={styles.list}>
            {(events ?? []).map((event) => (
              <li key={event.id} className={styles.listRow}>
                <div>
                  <Link href={`/schedule/${event.id}`} className={styles.itemName}>
                    {event.title}
                  </Link>
                  <p className={styles.itemMeta}>
                    {new Date(event.start_time).toLocaleString()} ·{" "}
                    {event.location_id ? (locationName.get(event.location_id) ?? "Unknown location") : "Org-wide"}
                  </p>
                </div>
                <span className={styles.pillMuted}>{TYPE_LABEL[event.type] ?? event.type}</span>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </>
  );
}
