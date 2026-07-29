import { notFound } from "next/navigation";
import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { GenerateReportButton } from "./GenerateReportButton";
import { ReportCard } from "./ReportCard";
import { ThreatContextForm } from "./ThreatContextForm";
import { MIN_DAYS_BETWEEN_REPORTS } from "@/lib/threatIntelligence";
import styles from "@/styles/ui.module.css";

// Pulled out of the component body: react-hooks/purity flags impure calls
// (Date.now()) made directly during render — see billing/page.tsx's
// isPastTrial() for the same pattern.
function nextEligibleDate(latestGeneratedAt: string | undefined): Date | null {
  if (!latestGeneratedAt) return null;
  const next = new Date(new Date(latestGeneratedAt).getTime() + MIN_DAYS_BETWEEN_REPORTS * 24 * 60 * 60 * 1000);
  return next.getTime() > Date.now() ? next : null;
}

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
  const nextEligibleAt = nextEligibleDate(reports?.[0]?.generated_at);

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
            <p className={styles.disclaimer}>
              Reports draw on this organization&apos;s own incident/watchlist records, plus public web search and
              government advisories (DHS, FBI/CISA). They cannot access private social media — Facebook groups,
              Instagram, or TikTok content is not searchable this way and will not appear in a report.
            </p>

            {isAdmin && (
              <ThreatContextForm
                locationId={locationId}
                initialOrgContext={org?.threat_context ?? ""}
                initialLocationContext={location.threat_context ?? ""}
              />
            )}

            {Boolean(canManage) && (
              <GenerateReportButton
                locationId={locationId}
                nextEligibleAt={nextEligibleAt ? nextEligibleAt.toISOString() : null}
              />
            )}

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
