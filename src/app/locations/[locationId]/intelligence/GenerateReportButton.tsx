"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/styles/ui.module.css";

export function GenerateReportButton({
  locationId,
  nextEligibleAt,
}: {
  locationId: string;
  nextEligibleAt: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setLoading(true);
    setError("");

    let response: Response;
    let data: { error?: string } = {};
    try {
      response = await fetch(`/api/locations/${locationId}/intelligence/generate`, { method: "POST" });
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
