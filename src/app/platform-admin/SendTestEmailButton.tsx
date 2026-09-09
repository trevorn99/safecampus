"use client";

import { useState } from "react";
import styles from "@/styles/ui.module.css";

export function SendTestEmailButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSend() {
    setLoading(true);
    setMessage("");
    setError("");

    let response: Response;
    let data: { error?: string; sentTo?: string; oneClickUnsubscribe?: boolean } = {};
    try {
      response = await fetch("/api/email/test", { method: "POST" });
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
    setMessage(
      `Sent to ${data.sentTo}.${data.oneClickUnsubscribe ? "" : " EMAIL_UNSUBSCRIBE_SECRET isn't set, so it went without a one-click unsubscribe header."}`,
    );
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.button} ${styles.buttonSecondary}`}
        disabled={loading}
        onClick={handleSend}
      >
        {loading ? "Sending…" : "Send test reminder email"}
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
