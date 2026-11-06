"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

// Promote a team member to team lead, or step a lead back to member. The
// role used to be fixed at the moment someone was added: the only way to
// promote was to remove them and add them back, which nothing said.
export function TeamRoleButton({
  assignmentId,
  memberName,
  role,
}: {
  assignmentId: string;
  memberName: string;
  role: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isLead = role === "team_lead";

  async function toggle() {
    const prompt = isLead
      ? `Make ${memberName} a regular member of this team? They'll no longer be able to send announcements to it.`
      : `Make ${memberName} a team lead? Team leads can send announcements to this team.`;
    if (!window.confirm(prompt)) return;
    setLoading(true);
    setError("");
    // .select(): RLS refusing an update returns zero rows rather than an
    // error, which would otherwise look like it worked.
    const { data, error: updateError } = await createClient()
      .from("role_assignments")
      .update({ role: isLead ? "member" : "team_lead" })
      .eq("id", assignmentId)
      .select("id");
    setLoading(false);
    if (updateError || !data || data.length === 0) {
      setError("That change wasn't saved. Refresh the page and try again.");
      return;
    }
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.button} ${styles.buttonSecondary} ${styles.buttonCompact}`}
        disabled={loading}
        onClick={() => void toggle()}
      >
        {isLead ? "Make member" : "Make team lead"}
      </button>
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </>
  );
}
