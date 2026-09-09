"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/styles/ui.module.css";

// For roster entries added without an invite. Everything they're already
// scheduled for stays put — this just sends the sign-in link their row will
// attach to.
export function SendInviteButton({ memberId, name }: { memberId: string; name: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSend() {
    if (!window.confirm(`Send ${name} an invite email now?`)) return;
    setLoading(true);
    setError("");

    let response: Response;
    let data: { error?: string } = {};
    try {
      response = await fetch("/api/team/send-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
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
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.button} ${styles.buttonSecondary}`}
        disabled={loading}
        onClick={handleSend}
      >
        {loading ? "Sending…" : "Send invite"}
      </button>
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </>
  );
}
