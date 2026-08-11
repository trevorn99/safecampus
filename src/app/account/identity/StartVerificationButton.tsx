"use client";

import { useState } from "react";
import styles from "@/styles/ui.module.css";

export function StartVerificationButton({ label }: { label: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setLoading(true);
    setError("");

    let response: Response;
    let data: { url?: string; error?: string } = {};
    try {
      response = await fetch("/api/identity/create-session", { method: "POST" });
      data = await response.json();
    } catch {
      setLoading(false);
      setError("Something went wrong — please try again.");
      return;
    }

    if (!response.ok || !data.url) {
      setLoading(false);
      setError(data.error ?? "Something went wrong");
      return;
    }

    window.location.href = data.url;
  }

  return (
    <div>
      <button type="button" className={`${styles.button} ${styles.buttonPrimary}`} disabled={loading} onClick={handleClick}>
        {loading ? "Starting…" : label}
      </button>
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
