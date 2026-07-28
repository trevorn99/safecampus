"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "@/styles/ui.module.css";

export function CredentialsForm({ existingClientId }: { existingClientId: string | null }) {
  const router = useRouter();
  const [clientId, setClientId] = useState(existingClientId ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/integrations/planning-center/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, clientSecret }),
    });
    const body = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(body.error ?? "Something went wrong");
      return;
    }
    setClientSecret("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="pcoClientId">
          Client ID
        </label>
        <input
          id="pcoClientId"
          className={styles.input}
          required
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="pcoClientSecret">
          Client secret
          <span className={styles.hint}>{existingClientId ? " — leave saved value, or enter a new one to replace it" : ""}</span>
        </label>
        <input
          id="pcoClientSecret"
          type="password"
          className={styles.input}
          required={!existingClientId}
          placeholder={existingClientId ? "•••••••• (saved)" : ""}
          value={clientSecret}
          onChange={(event) => setClientSecret(event.target.value)}
        />
      </div>
      <div className={styles.actions}>
        <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={loading}>
          {loading ? "Saving…" : existingClientId ? "Update" : "Save"}
        </button>
      </div>
      {error && <p className={styles.errorText} role="alert">{error}</p>}
    </form>
  );
}
