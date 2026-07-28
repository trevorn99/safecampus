"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

export function CancelInviteButton({ memberId, name }: { memberId: string; name: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleCancel() {
    if (!window.confirm(`Cancel the invite for ${name}?`)) return;
    setLoading(true);
    const supabase = createClient();
    // RLS ("admin removes members") is what actually enforces this is
    // an org_admin of this exact org — no service-role step needed.
    await supabase.from("members").delete().eq("id", memberId);
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      className={`${styles.button} ${styles.buttonSecondary}`}
      disabled={loading}
      onClick={handleCancel}
    >
      Cancel invite
    </button>
  );
}
