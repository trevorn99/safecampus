import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import styles from "@/styles/ui.module.css";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  reviewed: "Reviewed",
  released: "Released",
};

export default async function ThreatIntelligenceIndexPage() {
  const { supabase, member, organizationName, isAdmin, isPlatformAdmin } = await requireMembership();

  const [{ data: org }, { data: locations }] = await Promise.all([
    supabase.from("organizations").select("threat_intel_enabled").eq("id", member.organization_id).single(),
    supabase.from("locations").select("id, name").eq("organization_id", member.organization_id).order("name"),
  ]);

  const enabled = Boolean(org?.threat_intel_enabled);
  const locationIds = (locations ?? []).map((location) => location.id);

  const { data: reports } =
    enabled && locationIds.length > 0
      ? await supabase
          .from("threat_reports")
          .select("location_id, generated_at, status")
          .in("location_id", locationIds)
          .order("generated_at", { ascending: false })
      : { data: [] };

  const latestByLocation = new Map<string, { generated_at: string; status: string }>();
  for (const report of reports ?? []) {
    if (!latestByLocation.has(report.location_id)) {
      latestByLocation.set(report.location_id, report);
    }
  }

  return (
    <>
      <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>Threat Intelligence</h1>
          <p className={styles.subtitle}>{organizationName}</p>
        </div>

        {!enabled ? (
          <div className={styles.card}>
            <p className={styles.helperText}>
              Threat Intelligence isn&apos;t enabled for your organization yet.
              {isAdmin ? (
                <>
                  {" "}
                  <a href="/billing" className={styles.link}>
                    Enable it from Billing
                  </a>
                  .
                </>
              ) : (
                " Ask an org admin to enable it from Billing."
              )}
            </p>
          </div>
        ) : (
          <div className={styles.card}>
            {(locations ?? []).length === 0 && <p className={styles.helperText}>No locations yet.</p>}
            <ul className={styles.list}>
              {(locations ?? []).map((location) => {
                const latest = latestByLocation.get(location.id);
                return (
                  <li key={location.id} className={styles.listRow}>
                    <div>
                      <p className={styles.itemName}>{location.name}</p>
                      <p className={styles.itemMeta}>
                        {latest
                          ? `Last report: ${new Date(latest.generated_at).toLocaleDateString()} · ${
                              STATUS_LABEL[latest.status] ?? latest.status
                            }`
                          : "No reports yet"}
                      </p>
                    </div>
                    <a href={`/locations/${location.id}/intelligence`} className={styles.link}>
                      View reports
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </main>
    </>
  );
}
