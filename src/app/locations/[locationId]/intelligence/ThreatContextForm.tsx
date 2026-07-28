"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

export function ThreatContextForm({
  locationId,
  initialOrgContext,
  initialLocationContext,
}: {
  locationId: string;
  initialOrgContext: string;
  initialLocationContext: string;
}) {
  const router = useRouter();
  const [orgContext, setOrgContext] = useState(initialOrgContext);
  const [locationContext, setLocationContext] = useState(initialLocationContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSaved(false);

    let orgResponse: Response;
    let locationResult: { error: { message: string } | null };
    try {
      [orgResponse, locationResult] = await Promise.all([
        fetch("/api/org/update-threat-context", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threatContext: orgContext }),
        }),
        createClient()
          .from("locations")
          .update({ threat_context: locationContext.trim() || null })
          .eq("id", locationId),
      ]);
    } catch {
      setLoading(false);
      setError("Something went wrong — please try again.");
      return;
    }

    setLoading(false);
    if (!orgResponse.ok) {
      const data = await orgResponse.json().catch(() => ({}) as { error?: string });
      setError(data.error ?? "Something went wrong");
      return;
    }
    if (locationResult.error) {
      setError(locationResult.error.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Report context</h2>
        <p className={styles.helperText}>
          Tell the report generator what to look for. This gets included every time a report is drafted for this
          organization or location.
        </p>
      </div>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="org-context">
            About your organization <span className={styles.hint}>(used for every location)</span>
          </label>
          <textarea
            id="org-context"
            className={styles.textarea}
            placeholder="e.g. We're a K-12 private school with ~800 students, primarily concerned about unauthorized visitors and custody disputes."
            value={orgContext}
            onChange={(event) => setOrgContext(event.target.value)}
            disabled={loading}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="location-context">
            Specific concerns for this location
          </label>
          <textarea
            id="location-context"
            className={styles.textarea}
            placeholder="e.g. Construction crew on-site through August; recent uptick in loitering near the east entrance."
            value={locationContext}
            onChange={(event) => setLocationContext(event.target.value)}
            disabled={loading}
          />
        </div>
        <div className={styles.actions}>
          <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={loading}>
            {loading ? "Saving…" : "Save context"}
          </button>
          {saved && <p className={styles.helperText}>Saved.</p>}
        </div>
        {error && (
          <p className={styles.errorText} role="alert">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
