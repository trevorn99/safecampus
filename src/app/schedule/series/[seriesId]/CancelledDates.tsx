"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

// Restoring a cancelled occurrence is just deleting its skip row: generation
// compares the recurrence rule against the events that exist, so once the
// skip is gone the date reads as missing again and the next run — or the
// "Generate upcoming events now" button — recreates it.
//
// The recreated event comes back with the positions its template defines and
// whoever is on the standing roster. The individual assignments that existed
// on the cancelled event were cascade-deleted with it and don't return.
export function CancelledDates({
  skips,
}: {
  skips: { id: string; label: string; past: boolean }[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState("");
  const [error, setError] = useState("");

  async function restore(skipId: string) {
    setPendingId(skipId);
    setError("");
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("event_series_skips").delete().eq("id", skipId);
    setPendingId("");
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    router.refresh();
  }

  if (skips.length === 0) {
    return <p className={styles.helperText}>No dates have been cancelled.</p>;
  }

  return (
    <>
      <ul className={styles.list}>
        {skips.map((skip) => (
          <li key={skip.id} className={styles.listRow}>
            <p className={styles.itemName}>{skip.label}</p>
            <div className={styles.tagRow}>
              {skip.past ? (
                <span className={styles.itemMeta}>Already past</span>
              ) : (
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonSecondary}`}
                  disabled={pendingId === skip.id}
                  onClick={() => restore(skip.id)}
                >
                  {pendingId === skip.id ? "Restoring…" : "Restore"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </>
  );
}
