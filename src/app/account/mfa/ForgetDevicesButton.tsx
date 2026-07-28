"use client";

import { useState } from "react";
import styles from "@/styles/ui.module.css";

export function ForgetDevicesButton() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleClick() {
    setLoading(true);
    await fetch("/api/auth/forget-trusted-devices", { method: "POST" });
    setLoading(false);
    setDone(true);
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Trusted devices</h2>
        <p className={styles.helperText}>
          Devices where you checked &quot;don&apos;t ask again&quot; during MFA. Forgetting them means
          every device (including this one) will be asked to verify again next time.
        </p>
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.button} ${styles.buttonSecondary}`}
          disabled={loading}
          onClick={handleClick}
        >
          {loading ? "Forgetting…" : "Forget all trusted devices"}
        </button>
      </div>
      {done && <p className={styles.helperText}>Done — all trusted devices have been forgotten.</p>}
    </div>
  );
}
