"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "@/styles/ui.module.css";

export function OrgNameForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSaved(false);

    let response: Response;
    let data: { error?: string } = {};
    try {
      response = await fetch("/api/org/update-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      data = await response.json();
    } catch {
      setLoading(false);
      setError("Something went wrong — please try again.");
      return;
    }

    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Organization name</h2>
      </div>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="org-name">
            Name
          </label>
          <input
            id="org-name"
            className={styles.input}
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={loading}
          />
        </div>
        <div className={styles.actions}>
          <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={loading}>
            {loading ? "Saving…" : "Save name"}
          </button>
          {saved && <p className={styles.helperText}>Saved.</p>}
        </div>
        {error && (
          <p className={styles.errorText} role="alert">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
