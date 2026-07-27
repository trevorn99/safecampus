"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

export function ActiveToggle({ seriesId, active }: { seriesId: string; active: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState(active);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("event_series").update({ active: !current }).eq("id", seriesId);
    setLoading(false);
    if (!error) {
      setCurrent(!current);
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      className={`${styles.button} ${current ? styles.buttonSecondary : styles.buttonPrimary}`}
      disabled={loading}
      onClick={handleToggle}
    >
      {current ? "Pause series" : "Resume series"}
    </button>
  );
}
