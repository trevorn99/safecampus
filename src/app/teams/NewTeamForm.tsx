"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

type Location = { id: string; name: string };

export function NewTeamForm({
  organizationId,
  locations,
}: {
  organizationId: string;
  locations: Location[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [locationId, setLocationId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.from("teams").insert({
      organization_id: organizationId,
      location_id: locationId || null,
      name,
      type,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setName("");
    setType("");
    setLocationId("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <div className={styles.actions}>
        <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={() => setOpen(true)}>
          + Add team
        </button>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>New team</h2>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="teamName">
            Name
          </label>
          <input
            id="teamName"
            className={styles.input}
            required
            placeholder="Medical Team"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="teamType">
            Type <span className={styles.hint}>e.g. medical, level_1, camera</span>
          </label>
          <input
            id="teamType"
            className={styles.input}
            required
            placeholder="medical"
            value={type}
            onChange={(event) => setType(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="teamLocation">
            Location <span className={styles.hint}>(optional — org-wide if left blank)</span>
          </label>
          <select
            id="teamLocation"
            className={styles.select}
            value={locationId}
            onChange={(event) => setLocationId(event.target.value)}
          >
            <option value="">Org-wide</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.actions}>
          <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={loading}>
            {loading ? "Saving…" : "Save team"}
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
