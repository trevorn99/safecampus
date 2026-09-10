"use client";

import { useState } from "react";
import styles from "@/styles/ui.module.css";

// Only meaningful for organizations with no Stripe subscription — see the
// route, which refuses the rest because Stripe would overwrite the change.
export function AddonGrantToggle({
  organizationId,
  enabled,
  billedThroughStripe,
}: {
  organizationId: string;
  enabled: boolean;
  billedThroughStripe: boolean;
}) {
  const [current, setCurrent] = useState(enabled);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    setLoading(true);
    setError("");

    let response: Response;
    let data: { error?: string } = {};
    try {
      response = await fetch("/api/platform-admin/toggle-addon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, addon: "threat_intel", enabled: !current }),
      });
      data = await response.json();
    } catch {
      setLoading(false);
      setError("Something went wrong");
      return;
    }

    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    setCurrent(!current);
  }

  if (billedThroughStripe) {
    return <span className={styles.pillMuted}>{enabled ? "On (Stripe)" : "Off (Stripe)"}</span>;
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.button} ${styles.buttonSecondary}`}
        disabled={loading}
        onClick={toggle}
      >
        {loading ? "Saving…" : current ? "Granted — revoke" : "Grant"}
      </button>
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </>
  );
}
