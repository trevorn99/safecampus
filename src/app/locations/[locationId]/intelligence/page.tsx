import { notFound } from "next/navigation";
import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { GenerateReportButton } from "./GenerateReportButton";
import { ReportCard } from "./ReportCard";
import { ThreatContextForm } from "./ThreatContextForm";
import styles from "@/styles/ui.module.css";

export default async function ThreatIntelligencePage({
  params,
}: {
  params: Promise<{ locationId: string }>;
}) {
  const { locationId } = await params;
  const { supabase, member, organizationName, isAdmin, isPlatformAdmin } = await requireMembership();

  const { data: location } = await supabase
    .from("locations")
    .select("id, name, threat_context")
    .eq("id", locationId)
    .eq("organization_id", member.organization_id)
    .maybeSingle();
  if (!location) {
    notFound();
  }

  const [{ data: canManage }, { data: org }, { data: reports }] = await Promise.all([
    supabase.rpc("is_location_manager", { target_location: locationId }),
    supabase
      .from("organizations")
      .select("threat_intel_enabled, threat_context")
      .eq("id", member.organization_id)
      .single(),
    supabase
      .from("threat_reports")
      .select("id, generated_at, summary, status, reviewed_at")
      .eq("location_id", locationId)
      .order("generated_at", { ascending: false }),
  ]);

  const enabled = Boolean(org?.threat_intel_enabled);

  return (
    <>
      <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>Threat Intelligence</h1>
          <p className={styles.subtitle}>
            {location.name} · {organizationName}
          </p>
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
          <>
            {isAdmin && (
              <ThreatContextForm
                locationId={locationId}
                initialOrgContext={org?.threat_context ?? ""}
                initialLocationContext={location.threat_context ?? ""}
              />
            )}

            {Boolean(canManage) && <GenerateReportButton locationId={locationId} />}

            {(reports ?? []).length === 0 && (
              <div className={styles.card}>
                <p className={styles.helperText}>No reports yet.</p>
              </div>
            )}

            {(reports ?? []).map((report) => (
              <ReportCard key={report.id} report={report} canManage={Boolean(canManage)} memberId={member.id} />
            ))}
          </>
        )}
      </main>
    </>
  );
}
