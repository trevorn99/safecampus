"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

export function RemoveTeamMemberButton({
  assignmentId,
  memberName,
}: {
  assignmentId: string;
  memberName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRemove() {
    // No confirmation: adding them back is one click, from this page or the
    // roster. Reserved for what can't be undone.
    setLoading(true);
    setError("");
    // .select(): a delete RLS refuses matches zero rows instead of erroring,
    // so without it a refused removal looked like it had worked.
    const { data, error: deleteError } = await createClient()
      .from("role_assignments")
      .delete()
      .eq("id", assignmentId)
      .select("id");
    setLoading(false);
    if (deleteError || !data || data.length === 0) {
      setError("That removal wasn't saved. Refresh the page and try again.");
      return;
    }
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.button} ${styles.buttonSecondary} ${styles.buttonCompact}`}
        disabled={loading}
        aria-label={`Remove ${memberName} from this team`}
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
