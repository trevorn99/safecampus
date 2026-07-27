"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

type Option = { id: string; name: string };

export function AssignMemberForm({
  positionId,
  eligibleMembers,
}: {
  positionId: string;
  eligibleMembers: Option[];
}) {
  const router = useRouter();
  const [memberId, setMemberId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMemberId("");
    router.refresh();
  }

  if (eligibleMembers.length === 0) {
    return <p className={styles.hint}>Everyone eligible for this position is already assigned.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className={styles.tagRow}>
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
      {error && <p className={styles.errorText} role="alert">{error}</p>}
    </form>
  );
}
