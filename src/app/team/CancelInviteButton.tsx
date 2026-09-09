"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

// `invited` false means this row was added to the roster without an invite
// ever going out, so there's nothing to cancel — it's a plain removal, and
// it takes their position assignments with it.
export function CancelInviteButton({
  memberId,
  name,
  invited,
}: {
  memberId: string;
  name: string;
  invited: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleCancel() {
    const prompt = invited
      ? `Cancel the invite for ${name}?`
      : `Remove ${name} from the roster? Any positions they\u2019re assigned to will be unfilled.`;
    if (!window.confirm(prompt)) return;
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
      {invited ? "Cancel invite" : "Remove"}
    </button>
  );
}
