"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

export function NewTemplateForm({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.from("event_templates").insert({
      organization_id: organizationId,
      name,
      description: description || null,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setName("");
    setDescription("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <div className={styles.actions}>
        <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={() => setOpen(true)}>
          + New template
        </button>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>New template</h2>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="templateName">
            Name
          </label>
          <input
            id="templateName"
            className={styles.input}
            required
            placeholder="Sunday Service"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="templateDescription">
            Description <span className={styles.hint}>(optional)</span>
          </label>
          <input
            id="templateDescription"
            className={styles.input}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className={styles.actions}>
          <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={loading}>
            {loading ? "Saving…" : "Save template"}
          </button>
          <button type="button" className={`${styles.button} ${styles.buttonSecondary}`} onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
        {error && <p className={styles.errorText} role="alert">{error}</p>}
      </form>
    </div>
  );
}
