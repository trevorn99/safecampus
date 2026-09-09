import Link from "next/link";
import Markdown from "react-markdown";
import { requireMembership } from "@/lib/session";
import { normalizeReportMarkdown } from "@/lib/reportMarkdown";
import { AutoPrint } from "./AutoPrint";
import styles from "@/styles/ui.module.css";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft — not for distribution",
  reviewed: "Reviewed — not yet released",
  released: "Released",
};

function formatGeneratedAt(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })} at ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

// A print-only rendering of one report: no app header, no nav, no action
// buttons — so the printed page needs no chrome stripped out of it beyond
// the root layout's footer. Deliberately its own route rather than a print
// stylesheet over the list page, which would mean hiding every other report
// and every control on it.
export default async function ReportPrintPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  const { supabase, member, organizationName } = await requireMembership();

  // No extra authorization here on purpose: threat_reports' own RLS is what
  // decides who sees which report (org admins see drafts, team leads only
  // released ones), exactly as it does on the list page. A report this
  // member may not read simply doesn't come back.
  const { data: report } = await supabase
    .from("threat_reports")
    .select("id, generated_at, summary, status, organization_id")
    .eq("id", reportId)
    .eq("organization_id", member.organization_id)
    .maybeSingle();

  if (!report || report.status === "generating") {
    return (
      <main className={styles.appMain}>
        <p className={styles.helperText}>That report isn&apos;t available.</p>
        <Link href="/threat-intelligence" className={styles.link}>
          ← Back to Threat Intelligence
        </Link>
      </main>
    );
  }

  return (
    <main className={styles.printDoc}>
      <AutoPrint />

      <header className={styles.printHeader}>
        <p className={styles.printEyebrow}>Threat Intelligence brief · {organizationName}</p>
        <p className={styles.printMeta}>Generated {formatGeneratedAt(report.generated_at)} · all locations combined</p>
        {/* The generation prompt is told never to write its own status line,
            because status changes after the text is written — so the status
            the app holds is stamped here instead. It matters most on paper:
            a PDF is exactly the copy that gets forwarded with none of the
            app's context around it. */}
        <p className={report.status === "released" ? styles.printStatus : styles.printStatusWarn}>
          {STATUS_LABEL[report.status] ?? report.status}
        </p>
      </header>

      <div className={`${styles.docBody} ${styles.reportMarkdown} ${styles.printBody}`}>
        <Markdown>{normalizeReportMarkdown(report.summary ?? "")}</Markdown>
      </div>

      <footer className={styles.printFootnote}>
        AI-drafted from this organization&apos;s own incident and watchlist records across every location, plus
        public web search, X/Twitter search, and government advisories (DHS, FBI/CISA). Private platforms —
        including private Facebook groups, Instagram, and TikTok — cannot be monitored automatically and do not
        appear here. Treat this as a starting point to combine with your team&apos;s own local knowledge, never as
        a replacement for it.
      </footer>

      <div className={styles.actions} data-print="hide">
        <Link href="/threat-intelligence" className={styles.link}>
          ← Back to Threat Intelligence
        </Link>
      </div>
    </main>
  );
}
