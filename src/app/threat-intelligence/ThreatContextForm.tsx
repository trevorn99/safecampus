"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

type LocationContext = { id: string; name: string; threatContext: string };

export function ThreatContextForm({
  initialOrgContext,
  locations,
}: {
  initialOrgContext: string;
  locations: LocationContext[];
}) {
  const router = useRouter();
  const [orgContext, setOrgContext] = useState(initialOrgContext);
  const [locationContexts, setLocationContexts] = useState<Record<string, string>>(
    Object.fromEntries(locations.map((location) => [location.id, location.threatContext])),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSaved(false);

    const supabase = createClient();
    let orgResponse: Response;
    let locationResults: { error: { message: string } | null }[];
    try {
      [orgResponse, ...locationResults] = await Promise.all([
        fetch("/api/org/update-threat-context", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threatContext: orgContext }),
        }),
        ...locations.map((location) =>
          supabase
            .from("locations")
            .update({ threat_context: (locationContexts[location.id] ?? "").trim() || null })
            .eq("id", location.id),
        ),
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
    const failed = locationResults.find((result) => result.error);
    if (failed?.error) {
      setError(failed.error.message);
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
          Tell the report generator what to look for. This gets included every time a combined report is drafted
          for your organization.
        </p>
      </div>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="org-context">
            About your organization <span className={styles.hint}>(applies to every location)</span>
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
        {locations.map((location) => (
          <div className={styles.field} key={location.id}>
            <label className={styles.label} htmlFor={`location-context-${location.id}`}>
              Specific concerns for {location.name}
            </label>
            <textarea
              id={`location-context-${location.id}`}
              className={styles.textarea}
              placeholder="e.g. Construction crew on-site through August; recent uptick in loitering near the east entrance."
              value={locationContexts[location.id] ?? ""}
              onChange={(event) =>
                setLocationContexts((current) => ({ ...current, [location.id]: event.target.value }))
              }
              disabled={loading}
            />
          </div>
        ))}
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
