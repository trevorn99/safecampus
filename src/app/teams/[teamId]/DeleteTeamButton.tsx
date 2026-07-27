"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

export function DeleteTeamButton({ teamId, name }: { teamId: string; name: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    if (!window.confirm(`Delete ${name}? This removes everyone's assignment to this team.`)) return;
    setLoading(true);
    setError("");

    const supabase = createClient();
    // scope_id on role_assignments isn't a real foreign key (it's polymorphic
    // across org/location/team), so deleting the team doesn't cascade here —
    // clean these up first.
    const { error: assignmentError } = await supabase
      .from("role_assignments")
      .delete()
      .eq("scope_type", "team")
      .eq("scope_id", teamId);
    if (assignmentError) {
      setLoading(false);
      setError(assignmentError.message);
      return;
    }

    const { error: teamError } = await supabase.from("teams").delete().eq("id", teamId);
    setLoading(false);
    if (teamError) {
      setError(teamError.message);
      return;
    }

    router.push("/teams");
    router.refresh();
  }

  return (
    <div className={styles.actions}>
      <button
        type="button"
        className={`${styles.button} ${styles.buttonSecondary}`}
        disabled={loading}
        onClick={handleDelete}
      >
        Delete team
      </button>
      {error && <p className={styles.errorText} role="alert">{error}</p>}
    </div>
  );
}
