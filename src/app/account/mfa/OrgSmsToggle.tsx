"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/styles/ui.module.css";

export function OrgSmsToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [justChanged, setJustChanged] = useState(false);

  async function handleToggle(next: boolean) {
    setLoading(true);
    setError("");
    setJustChanged(false);

    let response: Response;
    let data: { error?: string } = {};
    try {
      response = await fetch("/api/org/toggle-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
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
    setEnabled(next);
    setJustChanged(true);
    router.refresh();
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>SMS reminders — organization setting</h2>
        <p className={styles.helperText}>
          Master switch for your whole organization. Turning this off stops all shift-reminder texts, even for
          members who&apos;ve opted in.
        </p>
      </div>
      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => handleToggle(event.target.checked)}
          disabled={loading}
        />
        {loading ? "Saving…" : "Allow SMS reminders for this organization"}
      </label>
      {justChanged && <p className={styles.helperText}>{enabled ? "Enabled." : "Disabled."}</p>}
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
