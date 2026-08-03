"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Markdown from "react-markdown";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

type Report = {
  id: string;
  generated_at: string;
  summary: string | null;
  status: string;
  reviewed_at: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  reviewed: "Reviewed",
  released: "Released",
};

function statusPillClass(status: string): string {
  if (status === "released") return styles.badge;
  if (status === "reviewed") return styles.pill;
  return styles.pillMuted;
}

function formatGeneratedAt(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

// The model occasionally breaks a single paragraph across multiple lines
// (one sentence per line, or a break after a period) instead of writing
// flowing prose — CommonMark treats a lone "\n" as a soft break, but a
// non-breaking one still reads as a stray new line once rendered. Merge any
// line that isn't blank, a heading, or a list item into the previous line
// with a space, so genuine paragraph/list/heading breaks are kept and
// nothing else is.
function normalizeReportMarkdown(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  const isStructural = (line: string) => /^\s*(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s)/.test(line) || line.trim() === "";

  for (const line of lines) {
    const previous = result[result.length - 1];
    if (result.length === 0 || isStructural(line) || previous === undefined || isStructural(previous)) {
      result.push(line);
    } else {
      result[result.length - 1] = `${previous.replace(/\s+$/, "")} ${line.replace(/^\s+/, "")}`;
    }
  }
  return result.join("\n");
}

export function ReportCard({
  report,
  canManage,
  memberId,
}: {
  report: Report;
  canManage: boolean;
  memberId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function markReviewed() {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase
      .from("threat_reports")
      .update({ status: "reviewed", reviewed_by: memberId, reviewed_at: new Date().toISOString() })
      .eq("id", report.id);
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  async function release() {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.from("threat_reports").update({ status: "released" }).eq("id", report.id);
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.tagRow}>
          <span className={statusPillClass(report.status)}>{STATUS_LABEL[report.status] ?? report.status}</span>
          <span className={styles.itemMeta}>{formatGeneratedAt(report.generated_at)}</span>
        </div>
      </div>

      <div className={`${styles.docBody} ${styles.reportMarkdown}`}>
        <Markdown>{normalizeReportMarkdown(report.summary ?? "")}</Markdown>
      </div>

      {canManage && (
        <div className={styles.actions}>
          {report.status === "draft" && (
            <button
              type="button"
              className={`${styles.button} ${styles.buttonSecondary}`}
              disabled={loading}
              onClick={markReviewed}
            >
              Mark reviewed
            </button>
          )}
          {report.status === "reviewed" && (
            <button
              type="button"
              className={`${styles.button} ${styles.buttonPrimary}`}
              disabled={loading}
              onClick={release}
            >
              Release
            </button>
          )}
        </div>
      )}
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
