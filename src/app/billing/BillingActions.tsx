"use client";

import { useState } from "react";
import styles from "@/styles/ui.module.css";

async function goTo(path: string, setError: (message: string) => void) {
  const response = await fetch(path, { method: "POST" });
  const body = await response.json();
  if (!response.ok) {
    setError(body.error ?? "Something went wrong");
    return;
  }
  window.location.href = body.url;
}

export function BillingActions({ hasStripeCustomer }: { hasStripeCustomer: boolean }) {
  const [error, setError] = useState("");

  return (
    <div className={styles.actions}>
      <button
        type="button"
        className={`${styles.button} ${styles.buttonPrimary}`}
        onClick={() => goTo("/api/billing/checkout", setError)}
      >
        Subscribe
      </button>
      {hasStripeCustomer && (
        <button
          type="button"
          className={`${styles.button} ${styles.buttonSecondary}`}
          onClick={() => goTo("/api/billing/portal", setError)}
        >
          Manage billing
        </button>
      )}
      {error && <p className={styles.errorText} role="alert">{error}</p>}
    </div>
  );
}
