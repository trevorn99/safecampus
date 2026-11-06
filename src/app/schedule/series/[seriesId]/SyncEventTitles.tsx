"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

// Shown when upcoming events in a series carry a different name from the
// series itself — what a rename left behind before renames carried over to
// existing events (see EditSeriesForm). Renames only the title: times,
// locations and assignments are untouched, so it is safe to press even if
// some of those events were adjusted individually.
export function SyncEventTitles({
  seriesId,
  title,
  count,
}: {
  seriesId: string;
  title: string;
  count: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSync() {
    if (
      !window.confirm(
        `Rename ${count} upcoming ${count === 1 ? "event" : "events"} to “${title}”? Past events keep their name.`,
      )
    ) {
      return;
    }
    setLoading(true);
    setError("");
    const supabase = createClient();
    // .select() so an update that RLS silently matched to zero rows reads as
    // the failure it is, not as success followed by an unchanged list.
    const { data, error: updateError } = await supabase
      .from("events")
      .update({ title })
      .eq("series_id", seriesId)
      .gte("start_time", new Date().toISOString())
      .neq("title", title)
      .select("id");
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    if (!data || data.length === 0) {
      setError("Nothing was renamed. Refresh the page and try again.");
      return;
    }
    router.refresh();
  }

  return (
    <div className={styles.errorText} role="status">
      <strong>
        {count} upcoming {count === 1 ? "event has" : "events have"} a different name from this series.
      </strong>{" "}
      Usually left over from renaming the series.{" "}
      <button type="button" className={styles.linkButton} disabled={loading} onClick={handleSync}>
        {loading ? "Renaming…" : `Rename ${count === 1 ? "it" : "them"} to “${title}”`}
      </button>
      {error && <span> — {error}</span>}
    </div>
  );
}
