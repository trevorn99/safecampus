"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

export function NewLocationForm({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.from("locations").insert({
      organization_id: organizationId,
      name,
      address: address || null,
      timezone: timezone || null,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setName("");
    setAddress("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <div className={styles.actions}>
        <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={() => setOpen(true)}>
          + Add location
        </button>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>New location</h2>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="locName">
            Name
          </label>
          <input
            id="locName"
            className={styles.input}
            required
            placeholder="Main Campus"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="locAddress">
            Address <span className={styles.hint}>(optional)</span>
          </label>
          <input
            id="locAddress"
            className={styles.input}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="locTz">
            Timezone
          </label>
          <input
            id="locTz"
            className={styles.input}
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
          />
        </div>
        <div className={styles.actions}>
          <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={loading}>
            {loading ? "Saving…" : "Save location"}
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.buttonSecondary}`}
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>
        </div>
        {error && <p className={styles.errorText} role="alert">{error}</p>}
      </form>
    </div>
  );
}
