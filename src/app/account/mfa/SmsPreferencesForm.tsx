"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "@/styles/ui.module.css";

export function SmsPreferencesForm({
  currentPhone,
  currentOptIn,
  orgSmsEnabled,
}: {
  currentPhone: string | null;
  currentOptIn: boolean;
  orgSmsEnabled: boolean;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(currentPhone ?? "");
  const [smsOptIn, setSmsOptIn] = useState(currentOptIn);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setConfirmed(false);

    const wasOptedIn = currentOptIn;

    let response: Response;
    let data: { error?: string } = {};
    try {
      response = await fetch("/api/account/sms-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, smsOptIn }),
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

    if (smsOptIn && !wasOptedIn) {
      setConfirmed(true);
    }
    router.refresh();
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>SMS shift reminders</h2>
        <p className={styles.helperText}>
          Get a text 3 days and 24 hours before a shift you&apos;re assigned to. Msg &amp; data rates may apply.
        </p>
      </div>

      {!orgSmsEnabled && (
        <p className={styles.helperText}>Your organization has SMS reminders turned off right now.</p>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="sms-phone">
            Phone number
          </label>
          <input
            id="sms-phone"
            type="tel"
            className={styles.input}
            placeholder="+1 555 555 5555"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            disabled={loading}
          />
        </div>

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={smsOptIn}
            onChange={(event) => setSmsOptIn(event.target.checked)}
            disabled={loading}
          />
          Text me shift reminders
        </label>

        {error && (
          <p className={styles.errorText} role="alert">
            {error}
          </p>
        )}
        {confirmed && (
          <p className={styles.helperText}>You&apos;re subscribed — we just sent a confirmation text.</p>
        )}

        <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={loading}>
          {loading ? "Saving…" : "Save preference"}
        </button>
      </form>
    </div>
  );
}
