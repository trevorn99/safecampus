"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

export function RemoveTeamMemberButton({
  assignmentId,
  memberName,
}: {
  assignmentId: string;
  memberName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRemove() {
    if (!window.confirm(`Remove ${memberName} from this team?`)) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.from("role_assignments").delete().eq("id", assignmentId);
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
