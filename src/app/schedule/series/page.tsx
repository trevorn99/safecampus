import { redirect } from "next/navigation";
import Link from "next/link";
import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { describeRecurrenceRule } from "@/lib/recurrence";
import styles from "@/styles/ui.module.css";

export default async function SeriesListPage() {
  const { supabase, member, organizationName, isAdmin, isPlatformAdmin } = await requireMembership();

  if (!isAdmin) {
    redirect("/schedule");
  }

  const { data: seriesList } = await supabase
    .from("event_series")
    .select("id, title, recurrence_rule, active")
    .eq("organization_id", member.organization_id)
    .order("title");

  return (
    <>
      <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>Recurring series</h1>
          <p className={styles.subtitle}>{organizationName}</p>
        </div>

        <div className={styles.card}>
          {(seriesList ?? []).length === 0 && <p className={styles.helperText}>No recurring series yet.</p>}
          <ul className={styles.list}>
            {(seriesList ?? []).map((series) => (
              <li key={series.id} className={styles.listRow}>
                <div>
                  <Link href={`/schedule/series/${series.id}`} className={styles.itemName}>
                    {series.title}
                  </Link>
                  <p className={styles.itemMeta}>{describeRecurrenceRule(series.recurrence_rule)}</p>
                </div>
                {!series.active && <span className={styles.pillMuted}>Paused</span>}
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.actions}>
          <Link href="/schedule/new" className={`${styles.button} ${styles.buttonPrimary}`}>
            New series
          </Link>
          <Link href="/schedule" className={`${styles.button} ${styles.buttonSecondary}`}>
            Back to schedule
          </Link>
        </div>
      </main>
    </>
  );
}
