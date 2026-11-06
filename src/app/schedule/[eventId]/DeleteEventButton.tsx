"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";
import { useConfirm } from "@/components/ConfirmDialog";

export function DeleteEventButton({
  eventId,
  title,
  seriesId,
  startTime,
}: {
  eventId: string;
  title: string;
  seriesId: string | null;
  startTime: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const confirm = useConfirm();

  async function handleDelete() {
    const confirmed = await confirm(
      seriesId
        ? {
            title: `Cancel just the ${new Date(startTime).toLocaleDateString()} occurrence of “${title}”?`,
            message:
              "• The series itself is not deleted — every other date carries on.\n" +
              "• This date's positions and assignments are removed.\n" +
              "• The series won't recreate this date. You can restore it later from the series page.",
            confirmLabel: "Cancel this date",
            cancelLabel: "Keep it",
            tone: "danger",
          }
        : {
            title: `Delete “${title}”?`,
            message: "Its positions and assignments go with it, and this can't be undone.",
            confirmLabel: "Delete event",
            tone: "danger",
          },
    );
    if (!confirmed) return;

    setLoading(true);
    setError("");
    const supabase = createClient();

    // Recorded before the delete, not after: generation compares the
    // recurrence rule against the events that exist, so between deleting the
    // event and writing the skip this date reads as missing. The cron could
    // run in that window and put it straight back.
    if (seriesId) {
      const { error: skipError } = await supabase
        .from("event_series_skips")
        .insert({ series_id: seriesId, occurs_at: startTime });
      if (skipError) {
        setLoading(false);
        setError(`Couldn't cancel this date: ${skipError.message}`);
        return;
      }
    }

    // Positions, assignments and attendance follow through their own
    // cascades — see the events foreign keys.
    const { error: deleteError } = await supabase.from("events").delete().eq("id", eventId);
    if (deleteError) {
      setLoading(false);
      setError(deleteError.message);
      return;
    }

    router.push(seriesId ? `/schedule/series/${seriesId}` : "/schedule");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.button} ${styles.buttonSecondary}`}
        disabled={loading}
        onClick={handleDelete}
      >
        {loading ? "Deleting…" : seriesId ? "Cancel this occurrence" : "Delete event"}
      </button>
      {seriesId && (
        <span className={styles.itemMeta}>
          Cancels this date only — the series and its other dates are unaffected.
        </span>
      )}
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </>
  );
}
