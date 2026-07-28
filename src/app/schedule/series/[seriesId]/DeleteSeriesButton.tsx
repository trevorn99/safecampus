"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

export function DeleteSeriesButton({ seriesId, title }: { seriesId: string; title: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete the "${title}" series? Already-created events are kept — this only stops future generation.`,
      )
    )
      return;
    setLoading(true);
    const supabase = createClient();
    await supabase.from("event_series").delete().eq("id", seriesId);
    setLoading(false);
    router.push("/schedule/series");
    router.refresh();
  }

  return (
    <button
      type="button"
      className={`${styles.button} ${styles.buttonSecondary}`}
      disabled={loading}
      onClick={handleDelete}
    >
      Delete series
    </button>
  );
}
