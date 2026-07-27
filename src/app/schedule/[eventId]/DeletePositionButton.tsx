"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

export function DeletePositionButton({ positionId, title }: { positionId: string; title: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete the "${title}" position? This removes any assignments to it.`)) return;
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
