"use client";

import { useState } from "react";
import styles from "@/styles/ui.module.css";

// Checkout is started by a button press, never on page load: mail filters
// open links to inspect them, and a page that created a Stripe session on
// every visit would let them do it too.
export function PayButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/pay/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data: { url?: string; error?: string } = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) {
        setLoading(false);
        setError(data.error ?? "Something went wrong — please try again.");
        return;
      }
      window.location.assign(data.url);
    } catch {
      setLoading(false);
      setError("Something went wrong — please check your connection and try again.");
    }
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.button} ${styles.buttonPrimary}`}
        disabled={loading}
        onClick={() => void start()}
      >
        {loading ? "Opening secure checkout…" : "Continue to secure payment"}
      </button>
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </>
  );
}
