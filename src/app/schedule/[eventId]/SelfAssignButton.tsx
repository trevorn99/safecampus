"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { assignAcrossSeries } from "@/lib/assignAcrossSeries";
import styles from "@/styles/ui.module.css";

export function SelfAssignButton({
  positionId,
  memberId,
  seriesId,
  templatePositionId,
}: {
  positionId: string;
  memberId: string;
  seriesId: string | null;
  templatePositionId: string | null;
}) {
  const router = useRouter();
  const [applyToSeries, setApplyToSeries] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canApplyToSeries = Boolean(seriesId && templatePositionId);

  async function handleSignUp() {
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.from("assignments").insert({
      event_position_id: positionId,
      member_id: memberId,
    });

    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    if (applyToSeries && canApplyToSeries) {
      await assignAcrossSeries(supabase, memberId, seriesId!, templatePositionId!, positionId);
    }

    setLoading(false);
    router.refresh();
  }

  return (
    <div className={styles.form}>
      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.button} ${styles.buttonPrimary}`}
          disabled={loading}
          onClick={handleSignUp}
        >
          {loading ? "Signing up…" : "Sign up for this position"}
        </button>
      </div>
      {canApplyToSeries && (
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={applyToSeries}
            onChange={(event) => setApplyToSeries(event.target.checked)}
          />
          Also sign up for every future event in this series
        </label>
      )}
      {error && <p className={styles.errorText} role="alert">{error}</p>}
    </div>
  );
}
