"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/styles/ui.module.css";

export function GenerateNowButton({ seriesId }: { seriesId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleGenerate() {
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/schedule/series/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seriesId }),
    });
    const body = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(body.error ?? "Something went wrong");
      return;
    }
    setMessage(body.eventsCreated > 0 ? `Created ${body.eventsCreated} event(s).` : "Already up to date.");
    router.refresh();
  }

  return (
    <div className={styles.actions}>
      <button
        type="button"
        className={`${styles.button} ${styles.buttonSecondary}`}
        disabled={loading}
        onClick={handleGenerate}
      >
        {loading ? "Generating…" : "Generate upcoming events now"}
      </button>
      {message && <p className={styles.hint}>{message}</p>}
    </div>
  );
}
