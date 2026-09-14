import Link from "next/link";
import { requireMembership } from "@/lib/session";
import { resolveTimeZone } from "@/lib/resolveTimeZone";
import { formatEventTimeRange } from "@/lib/formatDateTime";
import { CheckInButton } from "./CheckInButton";
import styles from "@/styles/ui.module.css";

// How far either side of now counts as "your shift". A calendar day would be
// simpler and wrong at both ends: arriving at 8:30 for a 9am service is
// today, and checking out of a shift that began at 10pm happens tomorrow.
const WINDOW_HOURS = 12;

type AssignmentRow = {
  id: string;
  status: string;
  event_positions: {
    id: string;
    title: string;
    start_time: string;
    end_time: string | null;
    events: { id: string; title: string; location_id: string | null } | null;
  } | null;
};

// Pulled out of the component body — react-hooks/purity flags impure calls
// (Date.now) made directly during render.
function windowBounds() {
  const now = Date.now();
  return {
    from: new Date(now - WINDOW_HOURS * 60 * 60 * 1000).toISOString(),
    to: new Date(now + WINDOW_HOURS * 60 * 60 * 1000).toISOString(),
  };
}

export default async function CheckInPage() {
  const { supabase, member, organizationName } = await requireMembership();
  const { from, to } = windowBounds();

  const [{ data: assignments }, timeZone] = await Promise.all([
    supabase
      .from("assignments")
      .select("id, status, event_positions!inner(id, title, start_time, end_time, events(id, title, location_id))")
      .eq("member_id", member.id)
      .neq("status", "declined")
      .gte("event_positions.start_time", from)
      .lte("event_positions.start_time", to)
      .returns<AssignmentRow[]>(),
    resolveTimeZone(supabase, member.organization_id, null),
  ]);

  const shifts = (assignments ?? [])
    .filter((row) => row.event_positions?.events)
    .sort((a, b) => a.event_positions!.start_time.localeCompare(b.event_positions!.start_time));

  // Attendance already recorded for these events, so a shift checked into
  // offers checking out rather than checking in a second time.
  const eventIds = [...new Set(shifts.map((row) => row.event_positions!.events!.id))];
  const { data: attendance } = eventIds.length
    ? await supabase
        .from("attendance")
        .select("id, event_id, checked_in_at, checked_out_at")
        .eq("member_id", member.id)
        .in("event_id", eventIds)
    : { data: [] as { id: string; event_id: string; checked_in_at: string; checked_out_at: string | null }[] };

  const attendanceByEvent = new Map((attendance ?? []).map((row) => [row.event_id, row]));

  return (
    <main className={styles.appMain}>
      <div className={styles.pageHeading}>
        <h1 className={styles.pageTitle}>Check in</h1>
        <p className={styles.subtitle}>{organizationName}</p>
      </div>

      {shifts.length === 0 ? (
        <div className={styles.card}>
          <p className={styles.helperText}>
            Nothing to check into right now. A shift appears here from {WINDOW_HOURS} hours before it starts until{" "}
            {WINDOW_HOURS} hours after.
          </p>
          <Link href="/schedule" className={styles.link}>
            See the full schedule →
          </Link>
        </div>
      ) : (
        shifts.map((row) => {
          const position = row.event_positions!;
          const event = position.events!;
          return (
            <div key={row.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>{position.title}</h2>
                <p className={styles.itemMeta}>
                  {event.title} · {formatEventTimeRange(position.start_time, position.end_time, timeZone)}
                </p>
              </div>
              <CheckInButton
                memberId={member.id}
                eventId={event.id}
                eventPositionId={position.id}
                locationId={event.location_id}
                attendance={attendanceByEvent.get(event.id) ?? null}
              />
            </div>
          );
        })
      )}

      <Link href="/dashboard" className={styles.link}>
        ← Dashboard
      </Link>
    </main>
  );
}
