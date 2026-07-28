"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

type Option = { id: string; name: string };

export function AddTemplatePositionForm({ templateId, teams }: { templateId: string; teams: Option[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [teamId, setTeamId] = useState("");
  const [startOffset, setStartOffset] = useState("0");
  const [endOffset, setEndOffset] = useState("");
  const [slots, setSlots] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.from("template_positions").insert({
      template_id: templateId,
      title,
      team_id: teamId || null,
      start_offset_minutes: Number(startOffset),
      end_offset_minutes: endOffset ? Number(endOffset) : null,
      slots: Number(slots),
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setTitle("");
    setTeamId("");
    setStartOffset("0");
    setEndOffset("");
    setSlots("1");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="tpTitle">
          Position
        </label>
        <input
          id="tpTitle"
          className={styles.input}
          required
          placeholder="Main Entrance"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="tpTeam">
          Team <span className={styles.hint}>(optional)</span>
        </label>
        <select id="tpTeam" className={styles.select} value={teamId} onChange={(event) => setTeamId(event.target.value)}>
          <option value="">Any team</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="tpStartOffset">
          Starts <span className={styles.hint}>minutes relative to the event start (0 = same time, -30 = 30 min early)</span>
        </label>
        <input
          id="tpStartOffset"
          type="number"
          className={styles.input}
          required
          value={startOffset}
          onChange={(event) => setStartOffset(event.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="tpEndOffset">
          Ends <span className={styles.hint}>minutes relative to the event start (optional)</span>
        </label>
        <input
          id="tpEndOffset"
          type="number"
          className={styles.input}
          value={endOffset}
          onChange={(event) => setEndOffset(event.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="tpSlots">
          People needed
        </label>
        <input
          id="tpSlots"
          type="number"
          min={1}
          className={styles.input}
          required
          value={slots}
          onChange={(event) => setSlots(event.target.value)}
        />
      </div>
      <div className={styles.actions}>
        <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={loading}>
          {loading ? "Adding…" : "Add position"}
        </button>
      </div>
      {error && <p className={styles.errorText} role="alert">{error}</p>}
    </form>
  );
}
