"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

export function BillingActions({
  hasStripeCustomer,
  hasSubscription,
}: {
  hasStripeCustomer: boolean;
  hasSubscription: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);

  async function syncStatus() {
    setSyncing(true);
    setError("");
    const response = await fetch("/api/billing/sync", { method: "POST" });
    const body = await response.json();
    setSyncing(false);
    if (!response.ok) {
      setError(body.error ?? "Something went wrong");
      return;
    }
    router.refresh();
  }

  return (
    <div className={styles.actions}>
      {!hasSubscription && (
        <button
          type="button"
          className={`${styles.button} ${styles.buttonPrimary}`}
          onClick={() => goTo("/api/billing/checkout", setError)}
        >
          Subscribe
        </button>
      )}
      {hasStripeCustomer && (
        <button
          type="button"
          className={`${styles.button} ${styles.buttonSecondary}`}
          onClick={() => goTo("/api/billing/portal", setError)}
        >
          Manage billing
        </button>
      )}
      {hasSubscription && (
        <button
          type="button"
          className={`${styles.button} ${styles.buttonSecondary}`}
          disabled={syncing}
          onClick={syncStatus}
        >
          {syncing ? "Checking…" : "Check subscription status"}
        </button>
      )}
      {error && <p className={styles.errorText} role="alert">{error}</p>}
    </div>
  );
}
