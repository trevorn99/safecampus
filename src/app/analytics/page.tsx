import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { EventTypeBarChart } from "@/components/charts/EventTypeBarChart";
import { FillRateChart } from "@/components/charts/FillRateChart";
import { DailySignInsChart } from "@/components/charts/DailySignInsChart";
import { RegistrationBar } from "@/components/charts/RegistrationBar";
import { getPeopleStats, type PersonRow } from "@/lib/peopleAnalytics";
import { resolveTimeZone } from "@/lib/resolveTimeZone";
import {
  getEventTypeBreakdown,
  getWeeklyFillRate,
  getExpiringCertifications,
  getAttendanceStat,
} from "@/lib/analytics";
import styles from "@/styles/ui.module.css";

const ACTIVITY_WINDOW_DAYS = 90;
const FILL_RATE_WEEKS = 8;
const CERT_HORIZON_DAYS = 30;
const SIGN_IN_WINDOW_DAYS = 30;

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

// The window has to close as well as open. Series now generate a year ahead,
// so an unbounded "since" sweeps in hundreds of events that haven't happened
// — "Events, last 90 days" was counting next spring's Sundays.
function nowIso(): string {
  return new Date().toISOString();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// "3 days ago" reads faster than a date when the question is "is this
// person still around?" — past two months the date itself is clearer.
function relativeDays(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 60) return `${days} days ago`;
  return formatDate(iso);
}

function describePerson(person: PersonRow): string {
  if (person.stage === "not_invited") return "On the roster, not invited yet";
  if (person.stage === "invited") {
    return person.invitedAt ? `Invited ${relativeDays(person.invitedAt)}, hasn't accepted` : "Invited, hasn't accepted";
  }
  const parts = [person.joinedAt ? `Joined ${formatDate(person.joinedAt)}` : "Joined"];
  if (person.hasMfa) parts.push("2FA on");
  return parts.join(" · ");
}

export default async function AnalyticsPage() {
  const { supabase, member, organizationName, isAdmin, isPlatformAdmin } = await requireMembership();

  if (!isAdmin) {
    redirect("/dashboard");
  }

  const sinceIso = daysAgoIso(ACTIVITY_WINDOW_DAYS);
  const untilIso = nowIso();

  const timeZone = await resolveTimeZone(supabase, member.organization_id, null);
  const [eventTypeBreakdown, weeklyFillRate, expiringCerts, attendanceStat, people] = await Promise.all([
    getEventTypeBreakdown(supabase, member.organization_id, sinceIso, untilIso),
    getWeeklyFillRate(supabase, member.organization_id, FILL_RATE_WEEKS),
    getExpiringCertifications(supabase, member.organization_id, CERT_HORIZON_DAYS),
    getAttendanceStat(supabase, member.organization_id, sinceIso, untilIso),
    getPeopleStats(supabase, member.organization_id, timeZone, SIGN_IN_WINDOW_DAYS),
  ]);
  const totalSignIns = people.dailySignIns.reduce((sum, d) => sum + d.count, 0);
  const methodSummary = [
    people.signInsByMethod.email_code ? `${people.signInsByMethod.email_code} with an email code` : null,
    people.signInsByMethod.google ? `${people.signInsByMethod.google} with Google` : null,
    people.signInsByMethod.email_link ? `${people.signInsByMethod.email_link} with an older email link` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const totalEvents = eventTypeBreakdown.reduce((sum, d) => sum + d.count, 0);
  const weeksWithSlots = weeklyFillRate.filter((w) => w.total > 0);
  const avgFillRate =
    weeksWithSlots.length > 0
      ? weeksWithSlots.reduce((sum, w) => sum + w.rate, 0) / weeksWithSlots.length
      : null;

  return (
    <>
      <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>Analytics</h1>
          <p className={styles.subtitle}>{organizationName} · trailing {ACTIVITY_WINDOW_DAYS} days</p>
        </div>

        <div className={styles.statGrid}>
          <div className={styles.statTile}>
            <span className={styles.statLabel}>Events, last {ACTIVITY_WINDOW_DAYS} days</span>
            <span className={styles.statValue}>{totalEvents}</span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statLabel}>Attendance records</span>
            <span className={styles.statValue}>{attendanceStat.totalRecords}</span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statLabel}>Avg. scheduling fill rate</span>
            <span className={styles.statValue}>{avgFillRate === null ? "—" : `${Math.round(avgFillRate * 100)}%`}</span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statLabel}>Certifications expiring, {CERT_HORIZON_DAYS} days</span>
            <span className={styles.statValue}>{expiringCerts.length}</span>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Events by type</h2>
            <p className={styles.helperText}>Last {ACTIVITY_WINDOW_DAYS} days</p>
          </div>
          <EventTypeBarChart data={eventTypeBreakdown} />
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Scheduling fill rate</h2>
            <p className={styles.helperText}>Assigned slots ÷ total slots, by week</p>
          </div>
          <FillRateChart data={weeklyFillRate} />
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Certifications expiring soon</h2>
            <p className={styles.helperText}>Next {CERT_HORIZON_DAYS} days</p>
          </div>
          {expiringCerts.length === 0 && <p className={styles.helperText}>Nothing expiring soon.</p>}
          <ul className={styles.list}>
            {expiringCerts.map((cert, index) => (
              <li key={index} className={styles.listRow}>
                <div>
                  <p className={styles.itemName}>{cert.memberName}</p>
                  <p className={styles.itemMeta}>{cert.type}</p>
                </div>
                <span className={styles.pillMuted}>{formatDate(cert.expiresAt)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.pageHeading}>
          <h2 className={styles.sectionTitle}>Members &amp; sign-ins</h2>
          <p className={styles.subtitle}>Who has joined, and who is actually using SafeCampus</p>
        </div>

        <div className={styles.statGrid}>
          <div className={styles.statTile}>
            <span className={styles.statLabel}>Members joined</span>
            <span className={styles.statValue}>
              {people.stages.joined} <span className={styles.statOf}>of {people.rosterSize}</span>
            </span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statLabel}>Signed in, last 7 days</span>
            <span className={styles.statValue}>{people.activeLast7}</span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statLabel}>Signed in, last 30 days</span>
            <span className={styles.statValue}>{people.activeLast30}</span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statLabel}>Invitations waiting</span>
            <span className={styles.statValue}>{people.stages.invited}</span>
            {people.oldestPendingDays !== null && (
              <span className={styles.statHint}>Oldest sent {people.oldestPendingDays} days ago</span>
            )}
          </div>
        </div>

        <div className={styles.statGrid}>
          <div className={styles.statTile}>
            <span className={styles.statLabel}>Typical time to accept</span>
            <span className={styles.statValue}>
              {people.medianDaysToAccept === null
                ? "—"
                : people.medianDaysToAccept < 1
                  ? "Same day"
                  : `${Math.round(people.medianDaysToAccept)} days`}
            </span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statLabel}>Two-factor set up</span>
            <span className={styles.statValue}>
              {people.mfaEnabled} <span className={styles.statOf}>of {people.stages.joined}</span>
            </span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statLabel}>Email reminders on</span>
            <span className={styles.statValue}>
              {people.emailReminders} <span className={styles.statOf}>of {people.stages.joined}</span>
            </span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statLabel}>Text reminders on</span>
            <span className={styles.statValue}>
              {people.smsReminders} <span className={styles.statOf}>of {people.stages.joined}</span>
            </span>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Registration</h2>
            <p className={styles.helperText}>
              {people.stages.joined} joined · {people.stages.invited} invited and waiting · {people.stages.not_invited} on
              the roster but not invited
            </p>
          </div>
          {people.rosterSize === 0 ? (
            <p className={styles.helperText}>No one on the roster yet.</p>
          ) : (
            <RegistrationBar
              parts={[
                { key: "joined", name: "Joined", count: people.stages.joined, slot: 1 },
                { key: "invited", name: "Invited, waiting", count: people.stages.invited, slot: 2 },
                { key: "not_invited", name: "Not invited", count: people.stages.not_invited, slot: 3 },
              ]}
            />
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Sign-ins per day</h2>
            <p className={styles.helperText}>
              {totalSignIns} in the last {SIGN_IN_WINDOW_DAYS} days{methodSummary ? ` — ${methodSummary}` : ""}.
              {people.trackingSince
                ? ` Recorded since ${formatDate(people.trackingSince)}.`
                : " Sign-ins are recorded from now on, so this fills in over the coming days."}
            </p>
          </div>
          <DailySignInsChart data={people.dailySignIns} />
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Everyone</h2>
            <p className={styles.helperText}>
              Longest without signing in first, then outstanding invitations — the order you&apos;d follow people up
              in.
            </p>
          </div>
          <ul className={styles.list}>
            {people.people.map((person) => (
              <li key={person.id} className={styles.listRow}>
                <div>
                  <p className={styles.itemName}>{person.name}</p>
                  <p className={styles.itemMeta}>{describePerson(person)}</p>
                </div>
                {person.stage === "joined" && (
                  <div className={styles.rowFigure}>
                    <span className={styles.itemMeta}>
                      {person.lastSignInAt ? `Last signed in ${relativeDays(person.lastSignInAt)}` : "Never signed in"}
                    </span>
                    {person.signInsInWindow > 0 && (
                      <span className={styles.itemMeta}>
                        {person.signInsInWindow} sign-in{person.signInsInWindow === 1 ? "" : "s"} in {SIGN_IN_WINDOW_DAYS} days
                      </span>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </main>
    </>
  );
}
