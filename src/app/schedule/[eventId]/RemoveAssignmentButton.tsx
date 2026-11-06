"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

// No confirmation: putting someone back on the position is one click, and
// this only affects this event — a regular's spot in the series stays.
export function RemoveAssignmentButton({ assignmentId, name }: { assignmentId: string; name: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRemove() {
    setLoading(true);
    setError("");
    // .select(): a delete RLS refuses matches zero rows rather than
    // erroring, which looked like it had worked.
    const { data, error: deleteError } = await createClient()
      .from("assignments")
      .delete()
      .eq("id", assignmentId)
      .select("id");
    setLoading(false);
    if (deleteError || !data || data.length === 0) {
      setError("That wasn't removed. Refresh the page and try again.");
      return;
    }
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.button} ${styles.buttonSecondary}`}
        disabled={loading}
        aria-label={`Remove ${name} from this position`}
        onClick={handleRemove}
      >
        Remove
      </button>
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </>
  );
}
