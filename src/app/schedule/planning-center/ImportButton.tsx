"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/styles/ui.module.css";

export function ImportButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleImport() {
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/integrations/planning-center/import", { method: "POST" });
    const body = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(body.error ?? "Import failed");
      return;
    }
    setMessage(body.imported > 0 ? `Found ${body.imported} upcoming event(s).` : "No new events found.");
    router.refresh();
  }

  return (
    <div className={styles.actions}>
      <button
        type="button"
        className={`${styles.button} ${styles.buttonPrimary}`}
        disabled={loading}
        onClick={handleImport}
      >
        {loading ? "Checking Planning Center…" : "Check for new events"}
      </button>
      {message && <p className={styles.hint}>{message}</p>}
    </div>
  );
}
