"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

export function DeleteTemplateButton({ templateId, name }: { templateId: string; name: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete the "${name}" template? This also removes all of its positions.`)) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.from("event_templates").delete().eq("id", templateId);
    setLoading(false);
    router.push("/schedule/templates");
    router.refresh();
  }

  return (
    <button
      type="button"
      className={`${styles.button} ${styles.buttonSecondary}`}
      disabled={loading}
      onClick={handleDelete}
    >
      Delete template
    </button>
  );
}
