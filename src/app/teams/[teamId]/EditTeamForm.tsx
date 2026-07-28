"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

type Location = { id: string; name: string };
type Team = { id: string; name: string; type: string; location_id: string | null };

export function EditTeamForm({ team, locations }: { team: Team; locations: Location[] }) {
  const router = useRouter();
  const [name, setName] = useState(team.name);
  const [type, setType] = useState(team.type);
  const [locationId, setLocationId] = useState(team.location_id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSaved(false);

    const supabase = createClient();
    const { error } = await supabase
      .from("teams")
      .update({ name, type, location_id: locationId || null })
      .eq("id", team.id);

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Team details</h2>
      </div>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="teamName">
            Name
          </label>
          <input
            id="teamName"
            className={styles.input}
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="teamType">
            Type
          </label>
          <input
            id="teamType"
            className={styles.input}
            required
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
            {loading ? "Saving…" : "Save changes"}
          </button>
        </div>
        {saved && <p className={styles.helperText}>Saved.</p>}
        {error && <p className={styles.errorText} role="alert">{error}</p>}
      </form>
    </div>
  );
}
