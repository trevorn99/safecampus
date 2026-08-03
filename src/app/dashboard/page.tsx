import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { Avatar } from "@/components/Avatar";
import { EventCalendar } from "@/components/EventCalendar";
import { getAvatarUrlMap } from "@/lib/avatars";
import styles from "@/styles/ui.module.css";

// Pulled out of the component body — react-hooks/purity flags impure calls
// (Date construction with no args) made directly during render.
function calendarWindow() {
  const now = new Date();
  const todayIso = now.toISOString();
  const minMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const maxMonth = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  const rangeEndExclusive = new Date(now.getFullYear(), now.getMonth() + 3, 1);
  return {
    todayIso,
    minMonthIso: minMonth.toISOString(),
    maxMonthIso: maxMonth.toISOString(),
    rangeStartIso: minMonth.toISOString(),
    rangeEndExclusiveIso: rangeEndExclusive.toISOString(),
  };
}

export default async function DashboardPage() {
  const { supabase, member, organizationName, isAdmin, isPlatformAdmin } = await requireMembership();

  const { todayIso, minMonthIso, maxMonthIso, rangeStartIso, rangeEndExclusiveIso } = calendarWindow();

  const [{ data: memberRow }, { data: events }] = await Promise.all([
    supabase.from("members").select("profile_picture_url").eq("id", member.id).single(),
    supabase
      .from("events")
      .select("id, title, start_time")
      .eq("organization_id", member.organization_id)
      .gte("start_time", rangeStartIso)
      .lt("start_time", rangeEndExclusiveIso)
      .order("start_time"),
  ]);

  const avatarUrls = await getAvatarUrlMap(supabase, [memberRow?.profile_picture_url]);
  const avatarUrl = memberRow?.profile_picture_url
    ? (avatarUrls.get(memberRow.profile_picture_url) ?? null)
    : null;

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

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Upcoming events</h2>
          </div>
          <EventCalendar events={events ?? []} today={todayIso} minMonth={minMonthIso} maxMonth={maxMonthIso} />
        </div>
      </main>
    </>
  );
}
