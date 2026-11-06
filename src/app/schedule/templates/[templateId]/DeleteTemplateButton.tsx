"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";
import { useConfirm } from "@/components/ConfirmDialog";

export function DeleteTemplateButton({ templateId, name }: { templateId: string; name: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const confirm = useConfirm();

  async function handleDelete() {
    if (!(await confirm({
        title: `Delete the “${name}” template?`,
        message: "All of its positions are removed too.",
        confirmLabel: "Delete template",
        tone: "danger",
      }))) return;
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
