"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "@/styles/ui.module.css";

export function GenerateReportButton({
  nextEligibleAt,
  generating,
  locationCount,
  locationsWithAddress,
}: {
  nextEligibleAt: string | null;
  generating: boolean;
  locationCount: number;
  /** Locations with a street address — the ones the per-campus searches use. */
  locationsWithAddress: number;
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

  // Blocked rather than merely warned: with no locations the brief can only
  // ever cover national advisories, which is not what anyone is paying for,
  // and it would still burn a week of the one-report-per-org cooldown.
  if (locationCount === 0) {
    return (
      <div className={styles.actions}>
        <button type="button" className={`${styles.button} ${styles.buttonPrimary}`} disabled>
          Generate report now
        </button>
        <p className={styles.helperText}>
          Add a location first — reports cover each of your campuses by name, and search for protests and local
          activity around their addresses. With none on file there&apos;s nothing campus-specific to report on.{" "}
          <Link href="/locations" className={styles.link}>
            Add a location
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className={styles.actions}>
      <button type="button" className={`${styles.button} ${styles.buttonPrimary}`} disabled={loading} onClick={handleGenerate}>
        {loading ? "Generating…" : "Generate report now"}
      </button>
      {locationsWithAddress === 0 && (
        <p className={styles.helperText}>
          None of your locations have a street address, so this report will skip the per-campus protest and local
          activity searches and cover national advisories only.{" "}
          <Link href="/locations" className={styles.link}>
            Add addresses
          </Link>
          .
        </p>
      )}
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
