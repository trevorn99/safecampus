"use client";

import { useState } from "react";
import styles from "@/styles/ui.module.css";

// Also available after the fact, and for a series occurrence — the checkbox
// on the create form only covers one-off events, since announcing a year of
// generated occurrences at once would be noise.
//
// Pressing it twice is safe: the route skips anyone already told about this
// event, so a second press only reaches people added since.
export function NotifyTeamButton({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function notify() {
    if (!window.confirm("Email the team about this event? Anyone already told about it is skipped.")) return;
    setLoading(true);
    setMessage("");
    setError("");

    let response: Response;
    let data: { error?: string; sent?: number; skipped?: number } = {};
    try {
      response = await fetch("/api/schedule/notify-event", {
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
    const sent = data.sent ?? 0;
    const skipped = data.skipped ?? 0;
    setMessage(
      sent === 0 && skipped === 0
        ? "Nobody to email — check that members have email reminders on and that your organization allows email."
        : `Emailed ${sent} ${sent === 1 ? "person" : "people"}${skipped > 0 ? `, skipped ${skipped} already told` : ""}.`,
    );
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.button} ${styles.buttonSecondary}`}
        disabled={loading}
        onClick={notify}
      >
        {loading ? "Emailing…" : "Email the team"}
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
