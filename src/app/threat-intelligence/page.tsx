import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { GenerateReportButton } from "./GenerateReportButton";
import { ReportCard } from "./ReportCard";
import { ThreatContextForm } from "./ThreatContextForm";
import { MIN_DAYS_BETWEEN_REPORTS, GENERATION_STALE_MINUTES } from "@/lib/threatIntelligence";
import styles from "@/styles/ui.module.css";

// Pulled out of the component body: react-hooks/purity flags impure calls
// (Date.now()) made directly during render — see billing/page.tsx's
// isPastTrial() for the same pattern.
function nextEligibleDate(latestGeneratedAt: string | undefined): Date | null {
  if (!latestGeneratedAt) return null;
  const next = new Date(new Date(latestGeneratedAt).getTime() + MIN_DAYS_BETWEEN_REPORTS * 24 * 60 * 60 * 1000);
  return next.getTime() > Date.now() ? next : null;
}

// Mirrors getGenerationStatus()'s staleness math so the UI never shows "in
// progress" for a placeholder the backend would already treat as dead.
function isActivelyGenerating(report: { status: string; generated_at: string } | undefined): boolean {
  if (!report || report.status !== "generating") return false;
  const ageMinutes = (Date.now() - new Date(report.generated_at).getTime()) / 60_000;
  return ageMinutes < GENERATION_STALE_MINUTES;
}

export default async function ThreatIntelligencePage() {
  const { supabase, member, organizationName, isAdmin, isPlatformAdmin } = await requireMembership();

  const { data: isTeamLead } = isAdmin
    ? { data: false }
    : await supabase.rpc("is_team_lead", { target_org: member.organization_id });

  const [{ data: org }, { data: locations }, { data: reports }] = await Promise.all([
    supabase
      .from("organizations")
      .select("threat_intel_enabled, threat_context")
      .eq("id", member.organization_id)
      .single(),
    supabase
      .from("locations")
      .select("id, name, threat_context")
      .eq("organization_id", member.organization_id)
      .order("name"),
    supabase
      .from("threat_reports")
      .select("id, generated_at, summary, status, reviewed_at")
      .eq("organization_id", member.organization_id)
      .order("generated_at", { ascending: false }),
  ]);

  const enabled = Boolean(org?.threat_intel_enabled);
  const generating = isActivelyGenerating(reports?.[0]);
  const nextEligibleAt = generating ? null : nextEligibleDate(reports?.[0]?.generated_at);
  const visibleReports = (reports ?? []).filter((report) => report.status !== "generating");

  return (
    <>
      <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>Threat Intelligence</h1>
          <p className={styles.subtitle}>{organizationName} · all locations combined</p>
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
        ) : !isAdmin && !isTeamLead ? (
          <div className={styles.card}>
            <p className={styles.helperText}>
              Threat Intelligence reports are visible to org admins, and to team leads once a report is released.
            </p>
          </div>
        ) : (
          <>
            <p className={styles.disclaimer}>
              This report is AI-drafted from your organization&apos;s own incident/watchlist records across every
              location, plus public web search, X/Twitter search, and government advisories (DHS, FBI/CISA). Certain
              platforms — including private Facebook groups, Instagram, and TikTok — cannot be monitored through an
              API in an automated fashion, so activity there will not appear here. Treat this report as a starting
              point: always combine it with your team&apos;s own human intelligence and local knowledge before
              acting on it, never as a replacement for it.
            </p>

            {isAdmin && (
              <>
                <ThreatContextForm
                  initialOrgContext={org?.threat_context ?? ""}
                  locations={(locations ?? []).map((location) => ({
                    id: location.id,
                    name: location.name,
                    threatContext: location.threat_context ?? "",
                  }))}
                />

                <GenerateReportButton
                  nextEligibleAt={nextEligibleAt ? nextEligibleAt.toISOString() : null}
                  generating={generating}
                />
              </>
            )}

            {visibleReports.length === 0 && (
              <div className={styles.card}>
                <p className={styles.helperText}>
                  {isAdmin ? "No reports yet." : "No released reports yet."}
                </p>
              </div>
            )}

            {visibleReports.map((report) => (
              <ReportCard key={report.id} report={report} canManage={isAdmin} memberId={member.id} />
            ))}
          </>
        )}
      </main>
    </>
  );
}
