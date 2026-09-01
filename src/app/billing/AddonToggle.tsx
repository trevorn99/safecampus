"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AddonKey } from "@/lib/stripe";
import styles from "@/styles/ui.module.css";

export function AddonToggle({
  addon,
  title,
  description,
  checkboxLabel,
  initialEnabled,
  hasSubscription,
  enabledMessage,
  disabledMessage,
}: {
  addon: AddonKey;
  title: string;
  description: string[];
  checkboxLabel: string;
  initialEnabled: boolean;
  hasSubscription: boolean;
  enabledMessage: string;
  disabledMessage: string;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [justChanged, setJustChanged] = useState(false);

  async function handleToggle(next: boolean) {
    setLoading(true);
    setError("");
    setJustChanged(false);

    let response: Response;
    let data: { error?: string } = {};
    try {
      response = await fetch("/api/billing/toggle-addon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next, addon }),
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
    setEnabled(next);
    setJustChanged(true);
    router.refresh();
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>{title}</h2>
        <div className={styles.cardDescription}>
          {description.map((paragraph, index) => (
            <p key={index} className={styles.helperText}>
              {paragraph}
            </p>
          ))}
        </div>
      </div>
      {!hasSubscription ? (
        <p className={styles.helperText}>Subscribe to a plan before enabling add-ons.</p>
      ) : (
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => handleToggle(event.target.checked)}
            disabled={loading}
          />
          {loading ? "Saving…" : checkboxLabel}
        </label>
      )}
      {justChanged && <p className={styles.helperText}>{enabled ? enabledMessage : disabledMessage}</p>}
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
