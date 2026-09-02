"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/styles/ui.module.css";

export function ExtendTrialForm({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [days, setDays] = useState("7");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleExtend() {
    const parsedDays = Number(days);
    if (!Number.isFinite(parsedDays) || parsedDays <= 0) {
      setError("Enter a positive number of days.");
      return;
    }
    setLoading(true);
    setError("");

    let response: Response;
    let data: { error?: string } = {};
    try {
      response = await fetch("/api/platform-admin/extend-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, days: parsedDays }),
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
    router.refresh();
  }

  return (
    <div className={styles.tagRow}>
      <input
        type="number"
        min={1}
        className={styles.input}
        style={{ width: "5rem" }}
        value={days}
        onChange={(event) => setDays(event.target.value)}
        aria-label="Days to extend trial"
      />
      <button
        type="button"
        className={`${styles.button} ${styles.buttonSecondary}`}
        disabled={loading}
        onClick={handleExtend}
      >
        {loading ? "Extending…" : "Extend trial"}
      </button>
      {error && <p className={styles.errorText} role="alert">{error}</p>}
    </div>
  );
}
