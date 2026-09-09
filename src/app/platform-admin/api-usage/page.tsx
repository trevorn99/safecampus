import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppHeader } from "@/components/AppHeader";
import { estimateCostUsd, formatUsd, type UsageRow } from "@/lib/claudeUsage";
import styles from "@/styles/ui.module.css";

// Spend, not customer content — so this page is reachable with the
// platform-admin check alone, like the billing columns on the console's
// index, and unlike /platform-admin/[orgId], which shows an org's actual
// data and demands a live support grant first.
const WINDOW_DAYS = 30;

// Pulled out of the component body — react-hooks/purity flags impure calls
// (Date.now) made directly during render, same as currentIso() on the
// platform-admin index.
function windowStartIso(): string {
  return new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

type UsageRecord = UsageRow & { organization_id: string; occurred_at: string; report_id: string | null };

export default async function PlatformAdminApiUsagePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: isPlatformAdmin } = await supabase.rpc("is_platform_admin");
  if (!isPlatformAdmin) {
    redirect("/dashboard");
  }

  const since = windowStartIso();
  const admin = createAdminClient();

  const [{ data: usage }, { data: organizations }, { data: xUsage }] = await Promise.all([
    admin
      .from("claude_api_usage")
      .select(
        "organization_id, occurred_at, report_id, model, input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens, web_search_requests",
      )
      .gte("occurred_at", since)
      .returns<UsageRecord[]>(),
    admin.from("organizations").select("id, name, threat_intel_enabled").order("name"),
    admin.from("x_api_usage").select("organization_id, reads_used").gte("occurred_at", since),
  ]);

  type Totals = {
    calls: number;
    reports: Set<string>;
    inputTokens: number;
    outputTokens: number;
    searches: number;
    costUsd: number;
  };
  const totalsByOrg = new Map<string, Totals>();
  for (const row of usage ?? []) {
    const totals = totalsByOrg.get(row.organization_id) ?? {
      calls: 0,
      reports: new Set<string>(),
      inputTokens: 0,
      outputTokens: 0,
      searches: 0,
      costUsd: 0,
    };
    totals.calls += 1;
    // A failed generation deletes its placeholder, which nulls report_id on
    // the rows it already wrote — those calls still cost money, so they're
    // counted here even though they belong to no surviving report.
    if (row.report_id) totals.reports.add(row.report_id);
    totals.inputTokens += row.input_tokens + row.cache_read_input_tokens + row.cache_creation_input_tokens;
    totals.outputTokens += row.output_tokens;
    totals.searches += row.web_search_requests;
    totals.costUsd += estimateCostUsd(row);
    totalsByOrg.set(row.organization_id, totals);
  }

  const xReadsByOrg = new Map<string, number>();
  for (const row of (xUsage ?? []) as { organization_id: string; reads_used: number }[]) {
    xReadsByOrg.set(row.organization_id, (xReadsByOrg.get(row.organization_id) ?? 0) + row.reads_used);
  }

  const rows = (organizations ?? [])
    .map((org) => ({
      id: org.id,
      name: org.name,
      threatIntelEnabled: org.threat_intel_enabled as boolean,
      totals: totalsByOrg.get(org.id),
      xReads: xReadsByOrg.get(org.id) ?? 0,
    }))
    .filter((row) => row.totals || row.xReads > 0 || row.threatIntelEnabled)
    .sort((a, b) => (b.totals?.costUsd ?? 0) - (a.totals?.costUsd ?? 0));

  const grandTotal = rows.reduce((sum, row) => sum + (row.totals?.costUsd ?? 0), 0);

  return (
    <>
      <AppHeader isAdmin={false} isPlatformAdmin />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>API usage</h1>
          <p className={styles.subtitle}>
            Claude consumption per organization, last {WINDOW_DAYS} days · {formatUsd(grandTotal)} estimated
          </p>
        </div>

        <div className={styles.actions}>
          <Link href="/platform-admin" className={`${styles.button} ${styles.buttonSecondary}`}>
            ← Back to platform admin
          </Link>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>By organization</h2>
            <p className={styles.helperText}>
              Costs are estimated from recorded token counts at Anthropic list prices, plus $10 per 1,000 web
              searches — close enough to spot an outlier, not a substitute for the invoice. Input includes tokens
              from search results, which are re-sent on every pause_turn resume.
            </p>
          </div>

          {rows.length === 0 ? (
            <p className={styles.helperText}>No organizations have the Threat Intelligence add-on enabled yet.</p>
          ) : (
            <ul className={styles.list}>
              {rows.map((row) => (
                <li key={row.id} className={styles.listRow}>
                  <div>
                    <p className={styles.itemName}>{row.name}</p>
                    <p className={styles.itemMeta}>
                      {row.totals
                        ? `${row.totals.reports.size} report${row.totals.reports.size === 1 ? "" : "s"} · ${row.totals.calls} API call${row.totals.calls === 1 ? "" : "s"} · ${row.totals.inputTokens.toLocaleString()} in / ${row.totals.outputTokens.toLocaleString()} out · ${row.totals.searches} search${row.totals.searches === 1 ? "" : "es"}`
                        : "No Claude usage in this window"}
                      {row.xReads > 0 ? ` · ${row.xReads.toLocaleString()} X reads` : ""}
                    </p>
                  </div>
                  <div className={styles.tagRow}>
                    {!row.threatIntelEnabled && <span className={styles.pillMuted}>Add-on off</span>}
                    <span className={styles.pill}>{formatUsd(row.totals?.costUsd ?? 0)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
