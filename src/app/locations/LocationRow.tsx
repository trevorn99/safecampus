"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

type Location = {
  id: string;
  name: string;
  address: string | null;
  timezone: string | null;
};

function googleMapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function LocationRow({ location, isAdmin }: { location: Location; isAdmin: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(location.name);
  const [address, setAddress] = useState(location.address ?? "");
  const [timezone, setTimezone] = useState(location.timezone ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase
      .from("locations")
      .update({ name, address: address || null, timezone: timezone || null })
      .eq("id", location.id);

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <li className={styles.listRow}>
        <form onSubmit={handleSubmit} className={styles.form} style={{ width: "100%" }}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`loc-name-${location.id}`}>
              Name
            </label>
            <input
              id={`loc-name-${location.id}`}
              className={styles.input}
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`loc-address-${location.id}`}>
              Address <span className={styles.hint}>(optional)</span>
            </label>
            <input
              id={`loc-address-${location.id}`}
              className={styles.input}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`loc-tz-${location.id}`}>
              Timezone
            </label>
            <input
              id={`loc-tz-${location.id}`}
              className={styles.input}
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
            />
          </div>
          <div className={styles.actions}>
            <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={loading}>
              {loading ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className={`${styles.button} ${styles.buttonSecondary}`}
              onClick={() => setEditing(false)}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
          {error && (
            <p className={styles.errorText} role="alert">
              {error}
            </p>
          )}
        </form>
      </li>
    );
  }

  return (
    <li className={styles.listRow}>
      <div>
        <p className={styles.itemName}>{location.name}</p>
        {location.address && (
          <p className={styles.itemMeta}>
            <a href={googleMapsUrl(location.address)} target="_blank" rel="noreferrer" className={styles.link}>
              {location.address}
            </a>
          </p>
        )}
      </div>
      <div className={styles.tagRow}>
        {location.timezone && <span className={styles.pillMuted}>{location.timezone}</span>}
        <a href={`/locations/${location.id}/map`} className={styles.link}>
          Map
        </a>
        <a href={`/locations/${location.id}/intelligence`} className={styles.link}>
          Intelligence
        </a>
        {isAdmin && (
          <button type="button" className={styles.linkButton} onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>
    </li>
  );
}
