"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/styles/ui.module.css";

export function ThreatIntelToggle({
  initialEnabled,
  hasSubscription,
}: {
  initialEnabled: boolean;
  hasSubscription: boolean;
}) {
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
      response = await fetch("/api/billing/toggle-addon", {
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
        <h2 className={styles.cardTitle}>Threat Intelligence — $30/mo add-on</h2>
        <p className={styles.helperText}>
          AI-drafted intelligence briefs for each location, refreshed weekly and available on demand — drawing
          on incident history and watchlist activity, reviewed by your admins before release.
        </p>
        <p className={styles.helperText}>
          Uses public web search and government advisories (DHS, FBI/CISA) — it cannot access private social media
          (Facebook groups, Instagram, TikTok).
        </p>
      </div>
      {!hasSubscription ? (
        <p className={styles.helperText}>Subscribe to a plan before enabling add-ons.</p>
      ) : (
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => handleToggle(event.target.checked)}
            disabled={loading}
          />
          {loading ? "Saving…" : "Enable Threat Intelligence for this organization"}
        </label>
      )}
      {justChanged && (
        <p className={styles.helperText}>
          {enabled
            ? "Enabled — generate or review reports from each location's Intelligence page."
            : "Disabled for this organization."}
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
