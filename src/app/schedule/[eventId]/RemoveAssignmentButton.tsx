"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

export function RemoveAssignmentButton({ assignmentId, name }: { assignmentId: string; name: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRemove() {
    if (!window.confirm(`Remove ${name} from this position?`)) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.from("assignments").delete().eq("id", assignmentId);
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      className={`${styles.button} ${styles.buttonSecondary}`}
      disabled={loading}
      onClick={handleRemove}
    >
      Remove
    </button>
  );
}
