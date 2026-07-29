"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/styles/ui.module.css";

export function RegenerateReportButton({ locationId }: { locationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleClick() {
    setLoading(true);
    setError("");
    setDone(false);

    let response: Response;
    let data: { error?: string } = {};
    try {
      response = await fetch("/api/platform-admin/regenerate-threat-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId }),
      });
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
    setDone(true);
    router.refresh();
  }

  return (
    <div className={styles.tagRow}>
      <button
        type="button"
        className={styles.linkButton}
        disabled={loading}
        onClick={handleClick}
      >
        {loading ? "Generating…" : "Regenerate report"}
      </button>
      {done && <span className={styles.itemMeta}>Done.</span>}
      {error && (
        <span className={styles.errorText} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
