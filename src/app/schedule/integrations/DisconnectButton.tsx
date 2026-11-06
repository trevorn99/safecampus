"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/styles/ui.module.css";
import { useConfirm } from "@/components/ConfirmDialog";

export function DisconnectButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const confirm = useConfirm();

  async function handleDisconnect() {
    if (!(await confirm({
        title: "Disconnect Planning Center?",
        message: "Checking for new events stops until you reconnect, which you can do at any time.",
        confirmLabel: "Disconnect",
      }))) return;
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
