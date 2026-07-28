"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/styles/ui.module.css";

export function DisconnectButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDisconnect() {
    if (!window.confirm("Disconnect Planning Center? You can reconnect any time.")) return;
    setLoading(true);
    await fetch("/api/integrations/planning-center/disconnect", { method: "POST" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      className={`${styles.button} ${styles.buttonSecondary}`}
      disabled={loading}
      onClick={handleDisconnect}
    >
      {loading ? "Disconnecting…" : "Disconnect"}
    </button>
  );
}
