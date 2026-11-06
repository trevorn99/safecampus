"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";
import { useConfirm } from "@/components/ConfirmDialog";

export function DeletePositionButton({ positionId, title }: { positionId: string; title: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const confirm = useConfirm();

  async function handleDelete() {
    if (!(await confirm({
        title: `Delete the “${title}” position?`,
        message: "Anyone assigned to it is taken off.",
        confirmLabel: "Delete position",
        tone: "danger",
      }))) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.from("event_positions").delete().eq("id", positionId);
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      className={`${styles.button} ${styles.buttonSecondary}`}
      disabled={loading}
      onClick={handleDelete}
    >
      Delete position
    </button>
  );
}
