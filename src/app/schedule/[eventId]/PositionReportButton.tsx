"use client";

import { useState } from "react";
import styles from "@/styles/ui.module.css";

// The same report the cron sends three days out, on request. Goes to the
// admin who pressed it and nowhere else.
export function PositionReportButton({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function send() {
    setLoading(true);
    setMessage("");
    setError("");

    let response: Response;
    let data: { error?: string } = {};
    try {
      response = await fetch("/api/schedule/position-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
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
    setMessage("Sent to your email address.");
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.button} ${styles.buttonSecondary}`}
        disabled={loading}
        onClick={send}
      >
        {loading ? "Sending…" : "Email me the position report"}
      </button>
      {message && <p className={styles.helperText}>{message}</p>}
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </>
  );
}
