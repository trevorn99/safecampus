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
          <span className={styles.pillMuted}>{STATUS_LABEL[report.status] ?? report.status}</span>
          <span className={styles.itemMeta}>{new Date(report.generated_at).toLocaleString()}</span>
        </div>
      </div>

      <div className={`${styles.docBody} ${styles.reportMarkdown}`}>
        <Markdown>{report.summary ?? ""}</Markdown>
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
