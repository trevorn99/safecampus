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

// The model breaks a single paragraph across multiple lines two different
// ways: a plain "\n" after every sentence, and — around web-search-cited
// material — a full blank line landing mid-sentence, e.g. "...the\n\nNational
// Terrorism Advisory System Bulletin...\n\n. That bulletin\n\nwas set to
// expire...". The second kind looks like a real paragraph break (blank line)
// but isn't one, so a blank line is only kept when it's actually justified:
// the text before it ends a sentence, or what follows is a heading/list.
// Anything else — blank or not — gets merged into the previous line, with no
// space inserted before punctuation that attaches to the prior word.
function normalizeReportMarkdown(text: string): string {
  const isStructural = (line: string) => /^\s*(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s)/.test(line);
  const endsSentence = (line: string) => /[.!?]["')\]]*\s*$/.test(line);
  const isAttachingPunctuation = (line: string) => /^\s*[.,;:!?)\]}]/.test(line);

  const lines = text.split("\n");
  const result: string[] = [];

  const nextNonBlank = (fromIndex: number) => {
    for (let i = fromIndex; i < lines.length; i++) {
      if (lines[i].trim() !== "") return lines[i];
    }
    return "";
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const previous = result[result.length - 1];
    const previousIsBlank = previous === undefined || previous.trim() === "";

    if (line.trim() === "") {
      const isGenuineBreak =
        previousIsBlank || isStructural(previous) || endsSentence(previous) || isStructural(nextNonBlank(i + 1));
      if (isGenuineBreak && !previousIsBlank) result.push(line);
      continue;
    }

    if (result.length === 0 || previousIsBlank || isStructural(line) || isStructural(previous)) {
      result.push(line);
      continue;
    }

    const glue = isAttachingPunctuation(line) ? "" : " ";
    result[result.length - 1] = `${previous.replace(/\s+$/, "")}${glue}${line.replace(/^\s+/, "")}`;
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
