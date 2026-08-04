"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

type EventType = { id: string; name: string };

export function EventTypesManager({
  organizationId,
  eventTypes,
}: {
  organizationId: string;
  eventTypes: EventType[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: insertError } = await supabase
      .from("event_types")
      .insert({ organization_id: organizationId, name: name.trim() });

    setLoading(false);
    if (insertError) {
      setError(
        insertError.code === "23505" ? "That type already exists." : insertError.message,
      );
      return;
    }
    setName("");
    router.refresh();
  }

  async function handleDelete(type: EventType) {
    if (!window.confirm(`Remove "${type.name}" from the list? Events already using it keep this type.`)) return;
    setDeletingId(type.id);
    setError("");

    const supabase = createClient();
    const { error: deleteError } = await supabase.from("event_types").delete().eq("id", type.id);

    setDeletingId(null);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Event types</h2>
        <p className={styles.helperText}>
          Customize the types available when creating an event or series. Removing a type doesn&apos;t change
          events already using it.
        </p>
      </div>

      {eventTypes.length === 0 && <p className={styles.helperText}>No event types yet — add one below.</p>}
      <ul className={styles.list}>
        {eventTypes.map((type) => (
          <li key={type.id} className={styles.listRow}>
            <p className={styles.itemName}>{type.name}</p>
            <button
              type="button"
              className={styles.linkButton}
              disabled={deletingId === type.id}
              onClick={() => handleDelete(type)}
            >
              {deletingId === type.id ? "Removing…" : "Remove"}
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={handleAdd} className={styles.tagRow}>
        <input
          className={styles.input}
          placeholder="e.g. Fire Watch"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" className={`${styles.button} ${styles.buttonSecondary}`} disabled={loading}>
          {loading ? "Adding…" : "Add type"}
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
