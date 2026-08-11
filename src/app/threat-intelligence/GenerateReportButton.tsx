"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/styles/ui.module.css";

export function GenerateReportButton({
  nextEligibleAt,
  generating,
}: {
  nextEligibleAt: string | null;
  generating: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // While a report is generating (whether started from this tab, another
  // tab, or the weekly cron), poll so the page notices it finished without
  // requiring a manual refresh — this is the same DB-backed state the
  // server checks, so it's accurate even if this tab wasn't the one that
  // started the run.
  useEffect(() => {
    if (!generating) return;
    const interval = setInterval(() => router.refresh(), 15_000);
    return () => clearInterval(interval);
  }, [generating, router]);

  async function handleGenerate() {
    setLoading(true);
    setError("");

    let response: Response;
    let data: { error?: string } = {};
    try {
      response = await fetch("/api/threat-intelligence/generate", { method: "POST" });
      data = await response.json();
    } catch {
      setLoading(false);
      setError("Something went wrong — please try again.");
      return;
    }

    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    router.refresh();
  }

  if (generating) {
    return (
      <div className={styles.actions}>
        <p className={styles.helperText}>
          A report is currently being generated for your organization — this can take a few minutes. This page
          updates automatically.
        </p>
      </div>
    );
  }

  if (nextEligibleAt) {
    return (
      <div className={styles.actions}>
        <p className={styles.helperText}>
          Only one report per week — the next one can be generated on {new Date(nextEligibleAt).toLocaleDateString()}.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.actions}>
      <button type="button" className={`${styles.button} ${styles.buttonPrimary}`} disabled={loading} onClick={handleGenerate}>
        {loading ? "Generating…" : "Generate report now"}
      </button>
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
