"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

export function DeleteSeriesButton({ seriesId, title }: { seriesId: string; title: string }) {
  const router = useRouter();
  // Defaults to on because "delete the series" almost always means "and stop
  // it appearing on my calendar". Leaving them behind was the old behaviour
  // and it stranded up to a year of events once the generation horizon grew.
  const [removeUpcoming, setRemoveUpcoming] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setError("");
    const supabase = createClient();
    const nowIso = new Date().toISOString();

    const { count } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("series_id", seriesId)
      .gte("start_time", nowIso);
    const upcoming = count ?? 0;

    const message = removeUpcoming
      ? `Delete the "${title}" series and its ${upcoming} upcoming event${upcoming === 1 ? "" : "s"}?\n\n` +
        `Positions and assignments on those events go too. Past events are kept as history.`
      : `Delete the "${title}" series but keep its ${upcoming} upcoming event${upcoming === 1 ? "" : "s"}?\n\n` +
        `Those events stay on the calendar permanently and lose their link to this series, so they can only be ` +
        `removed one at a time afterwards.`;
    if (!window.confirm(message)) return;

    setLoading(true);

    // Before deleting the series, not after: events.series_id is ON DELETE
    // SET NULL, so the moment the series row goes the events can no longer be
    // found by it. Deleting the series first is what stranded them.
    if (removeUpcoming && upcoming > 0) {
      const { error: eventsError } = await supabase
        .from("events")
        .delete()
        .eq("series_id", seriesId)
        .gte("start_time", nowIso);
      if (eventsError) {
        setLoading(false);
        setError(`Couldn't remove the upcoming events: ${eventsError.message}`);
        return;
      }
    }

    const { error: seriesError } = await supabase.from("event_series").delete().eq("id", seriesId);
    if (seriesError) {
      setLoading(false);
      setError(seriesError.message);
      return;
    }

    router.push("/schedule/series");
    router.refresh();
  }

  return (
    <>
      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={removeUpcoming}
          onChange={(event) => setRemoveUpcoming(event.target.checked)}
          disabled={loading}
        />
        Also remove its upcoming events <span className={styles.hint}>(past events are always kept)</span>
      </label>
      <button
        type="button"
        className={`${styles.button} ${styles.buttonSecondary}`}
        disabled={loading}
        onClick={handleDelete}
      >
        {loading ? "Deleting…" : "Delete series"}
      </button>
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </>
  );
}
