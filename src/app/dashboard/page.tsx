import Link from "next/link";
import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { Avatar } from "@/components/Avatar";
import { EventCalendar } from "@/components/EventCalendar";
import { getAvatarUrlMap } from "@/lib/avatars";
import { calendarWindow } from "@/lib/calendarWindow";
import { resolveTimeZone } from "@/lib/resolveTimeZone";
import styles from "@/styles/ui.module.css";

// A report older than this reads as "just part of the page" rather than
// an actual update worth calling out — roughly the weekly refresh cadence
// (see MIN_DAYS_BETWEEN_REPORTS in threatIntelligence.ts).
const RECENT_REPORT_WINDOW_DAYS = 7;

const REPORT_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  reviewed: "Reviewed",
  released: "Released",
};

function formatGeneratedAt(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

// Pulled out of the component body — react-hooks/purity flags impure calls
// (Date.now()) made directly during render, same as calendarWindow() above.
function isWithinRecentWindow(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < RECENT_REPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

export default async function DashboardPage() {
  const { supabase, member, organizationName, isAdmin, isPlatformAdmin } = await requireMembership();

  const { todayIso, minMonthIso, maxMonthIso, rangeStartIso, rangeEndExclusiveIso } = calendarWindow();

  const [{ data: memberRow }, { data: events }, { data: latestReport }, timeZone] = await Promise.all([
    supabase.from("members").select("profile_picture_url").eq("id", member.id).single(),
    supabase
      .from("events")
      .select("id, title, start_time, type")
      .eq("organization_id", member.organization_id)
      .gte("start_time", rangeStartIso)
      .lt("start_time", rangeEndExclusiveIso)
      .order("start_time"),
    // RLS already scopes which statuses come back — org admins see every
    // status, team leads see released only, everyone else sees nothing —
    // same rule the Threat Intelligence page itself enforces.
    supabase
      .from("threat_reports")
      .select("id, status, generated_at")
      .eq("organization_id", member.organization_id)
      .neq("status", "generating")
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    resolveTimeZone(supabase, member.organization_id, null),
  ]);

  const avatarUrls = await getAvatarUrlMap(supabase, [memberRow?.profile_picture_url]);
  const avatarUrl = memberRow?.profile_picture_url
    ? (avatarUrls.get(memberRow.profile_picture_url) ?? null)
    : null;

  const isRecentReport = latestReport && isWithinRecentWindow(latestReport.generated_at);

  return (
    <>
      <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
      <main className={styles.appMain}>
        <div className={styles.card}>
          <div className={styles.identityRow}>
            <Avatar name={member.name} url={avatarUrl} size="lg" />
            <div className={styles.cardHeader}>
              {isAdmin && <span className={styles.badge}>Org admin</span>}
              <h1 className={styles.cardTitle}>{organizationName}</h1>
              <p className={styles.subtitle}>Welcome, {member.name}.</p>
            </div>
          </div>
          <div className={styles.actions}>
            <a href="/team" className={`${styles.button} ${styles.buttonSecondary}`}>
              View team
            </a>
            {isAdmin && (
              <a href="/team/invite" className={`${styles.button} ${styles.buttonPrimary}`}>
                Invite a team member
              </a>
            )}
          </div>
        </div>

        {isRecentReport && latestReport && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Threat Intelligence updated</h2>
              <p className={styles.helperText}>
                {REPORT_STATUS_LABEL[latestReport.status] ?? latestReport.status} ·{" "}
                {formatGeneratedAt(latestReport.generated_at)}
              </p>
            </div>
            <Link href="/threat-intelligence" className={`${styles.button} ${styles.buttonSecondary}`}>
              View report
            </Link>
          </div>
        )}

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Upcoming events</h2>
          </div>
          <EventCalendar
            events={events ?? []}
            today={todayIso}
            minMonth={minMonthIso}
            maxMonth={maxMonthIso}
            timeZone={timeZone}
            canCreateEvents={isAdmin}
          />
        </div>
      </main>
    </>
  );
}
