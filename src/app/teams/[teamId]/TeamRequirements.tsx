"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

type Requirement = { id: string; kind: "certification" | "training"; name: string };

const KIND_LABEL: Record<string, string> = {
  certification: "Certification",
  training: "Training",
};

export function TeamRequirements({ teamId, requirements }: { teamId: string; requirements: Requirement[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<"certification" | "training">("certification");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: insertError } = await supabase
      .from("team_requirements")
      .insert({ team_id: teamId, kind, name: name.trim() });

    setLoading(false);
    if (insertError) {
      setError(insertError.code === "23505" ? "That requirement is already on this team." : insertError.message);
      return;
    }
    setName("");
    router.refresh();
  }

  async function handleRemove(requirement: Requirement) {
    setRemovingId(requirement.id);
    setError("");

    const supabase = createClient();
    const { error: deleteError } = await supabase.from("team_requirements").delete().eq("id", requirement.id);

    setRemovingId(null);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Requirements</h2>
        <p className={styles.helperText}>
          Certifications or trainings members of this team are expected to hold. Certification requirements are
          checked against each member&apos;s certifications below; training requirements are tracked here as policy
          only for now.
        </p>
      </div>

      {requirements.length === 0 && <p className={styles.helperText}>No requirements set for this team.</p>}
      <ul className={styles.list}>
        {requirements.map((requirement) => (
          <li key={requirement.id} className={styles.listRow}>
            <p className={styles.itemName}>
              {requirement.name} <span className={styles.hint}>({KIND_LABEL[requirement.kind]})</span>
            </p>
            <button
              type="button"
              className={styles.linkButton}
              disabled={removingId === requirement.id}
              onClick={() => handleRemove(requirement)}
            >
              {removingId === requirement.id ? "Removing…" : "Remove"}
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={handleAdd} className={styles.tagRow}>
        <select
          className={styles.select}
          value={kind}
          onChange={(event) => setKind(event.target.value as "certification" | "training")}
        >
          <option value="certification">Certification</option>
          <option value="training">Training</option>
        </select>
        <input
          className={styles.input}
          placeholder="e.g. CPR"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" className={`${styles.button} ${styles.buttonSecondary}`} disabled={loading}>
          {loading ? "Adding…" : "Add requirement"}
        </button>
      </form>
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
