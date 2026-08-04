import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { EventTypeBarChart } from "@/components/charts/EventTypeBarChart";
import { FillRateChart } from "@/components/charts/FillRateChart";
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

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function AnalyticsPage() {
  const { supabase, member, organizationName, isAdmin, isPlatformAdmin } = await requireMembership();

  if (!isAdmin) {
    redirect("/dashboard");
  }

  const sinceIso = daysAgoIso(ACTIVITY_WINDOW_DAYS);

  const [eventTypeBreakdown, weeklyFillRate, expiringCerts, attendanceStat] = await Promise.all([
    getEventTypeBreakdown(supabase, member.organization_id, sinceIso),
    getWeeklyFillRate(supabase, member.organization_id, FILL_RATE_WEEKS),
    getExpiringCertifications(supabase, member.organization_id, CERT_HORIZON_DAYS),
    getAttendanceStat(supabase, member.organization_id, sinceIso),
  ]);

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
      </main>
    </>
  );
}
