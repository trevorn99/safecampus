"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/styles/ui.module.css";

export function EmailPreferencesForm({
  email,
  currentOptIn,
  orgEmailEnabled,
}: {
  email: string | null;
  currentOptIn: boolean;
  orgEmailEnabled: boolean;
}) {
  const router = useRouter();
  const [optIn, setOptIn] = useState(currentOptIn);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // Saves on toggle rather than behind a Save button — there's only the one
  // field here, unlike the SMS form, which has a phone number to validate.
  async function handleToggle(next: boolean) {
    setLoading(true);
    setError("");
    setSaved(false);

    let response: Response;
    let data: { error?: string } = {};
    try {
      response = await fetch("/api/account/email-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOptIn: next }),
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
    setOptIn(next);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Email shift reminders</h2>
        <p className={styles.helperText}>
          Get an email 3 days and 24 hours before a shift you&apos;re assigned to, sent to{" "}
          {email ?? "your account email"}. Turning this off doesn&apos;t affect sign-in links or invites.
        </p>
      </div>

      {!orgEmailEnabled && (
        <p className={styles.helperText}>Your organization has email reminders turned off right now.</p>
      )}

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={optIn}
          onChange={(event) => handleToggle(event.target.checked)}
          disabled={loading || !email}
        />
        {loading ? "Saving…" : "Email me shift reminders"}
      </label>

      {!email && (
        <p className={styles.helperText}>
          There&apos;s no email address on your member record — ask an org admin to add one.
        </p>
      )}
      {saved && <p className={styles.helperText}>{optIn ? "Saved — reminders on." : "Saved — reminders off."}</p>}
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
