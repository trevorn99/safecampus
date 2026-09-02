"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { assignAcrossSeries } from "@/lib/assignAcrossSeries";
import styles from "@/styles/ui.module.css";

type Option = { id: string; name: string };

export function AssignMemberForm({
  positionId,
  eligibleMembers,
  poolSize,
  requiredTeamName,
  seriesId,
  templatePositionId,
}: {
  positionId: string;
  eligibleMembers: Option[];
  poolSize: number;
  requiredTeamName: string | null;
  seriesId: string | null;
  templatePositionId: string | null;
}) {
  const router = useRouter();
  const [memberId, setMemberId] = useState("");
  const [applyToSeries, setApplyToSeries] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canApplyToSeries = Boolean(seriesId && templatePositionId);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!memberId) return;
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
    setMemberId("");
    setApplyToSeries(false);
    router.refresh();
  }

  if (eligibleMembers.length === 0) {
    if (poolSize === 0 && requiredTeamName) {
      return (
        <p className={styles.hint}>
          No one is on the &quot;{requiredTeamName}&quot; team yet — add members to that team before you can assign
          this position.
        </p>
      );
    }
    return <p className={styles.hint}>Everyone eligible for this position is already assigned.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.tagRow}>
        <select
          className={styles.select}
          required
          value={memberId}
          onChange={(event) => setMemberId(event.target.value)}
        >
          <option value="">Assign someone…</option>
          {eligibleMembers.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        <button type="submit" className={`${styles.button} ${styles.buttonSecondary}`} disabled={loading}>
          {loading ? "Adding…" : "Assign"}
        </button>
      </div>
      {canApplyToSeries && (
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={applyToSeries}
            onChange={(event) => setApplyToSeries(event.target.checked)}
          />
          Also assign to every future event in this series
        </label>
      )}
      {error && <p className={styles.errorText} role="alert">{error}</p>}
    </form>
  );
}
