import { redirect } from "next/navigation";
import Link from "next/link";
import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { describeRecurrenceRule } from "@/lib/recurrence";
import { formatEventTimeRange } from "@/lib/formatDateTime";
import { resolveTimeZone } from "@/lib/resolveTimeZone";
import { SeriesHeader } from "./SeriesHeader";
import { AddSeriesPositionForm } from "./AddSeriesPositionForm";
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

  const [{ data: generatedEvents }, { data: locations }, { data: eventTypes }, { data: teams }, timeZone] =
    await Promise.all([
      supabase
        .from("events")
        .select("id, title, start_time, end_time")
        .eq("series_id", series.id)
        .order("start_time", { ascending: false })
        .limit(20),
      supabase.from("locations").select("id, name").eq("organization_id", member.organization_id),
      supabase.from("event_types").select("name").eq("organization_id", member.organization_id).order("name"),
      supabase.from("teams").select("id, name").eq("organization_id", member.organization_id),
      resolveTimeZone(supabase, member.organization_id, series.location_id),
    ]);

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
