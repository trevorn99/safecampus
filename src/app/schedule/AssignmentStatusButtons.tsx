"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

const STATUS_LABEL: Record<string, string> = {
  proposed: "Awaiting your response",
  confirmed: "Confirmed",
  declined: "Declined",
};

export function AssignmentStatusButtons({
  assignmentId,
  status,
}: {
  assignmentId: string;
  status: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [loading, setLoading] = useState(false);

  async function setStatus(next: "confirmed" | "declined") {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("assignments").update({ status: next }).eq("id", assignmentId);
    setLoading(false);
    if (!error) {
      setCurrent(next);
      router.refresh();
    }
  }

  return (
    <div className={styles.tagRow}>
      <span className={current === "proposed" ? styles.pillMuted : styles.pill}>
        {STATUS_LABEL[current] ?? current}
      </span>
      {current !== "confirmed" && (
        <button
          type="button"
          className={`${styles.button} ${styles.buttonPrimary}`}
          disabled={loading}
          onClick={() => setStatus("confirmed")}
        >
          Confirm
        </button>
      )}
      {current !== "declined" && (
        <button
          type="button"
          className={`${styles.button} ${styles.buttonSecondary}`}
          disabled={loading}
          onClick={() => setStatus("declined")}
        >
          Decline
        </button>
      )}
    </div>
  );
}
