"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

type Team = { id: string; name: string };

// assignmentIdsByTeam holds every role_assignments row this member has for
// a given team (normally at most one, but a member could in principle hold
// both a "member" and "team_lead" row for the same team — toggling off
// removes all of them, since either way "leave this team" means none left).
export function TeamMembershipManager({
  memberId,
  allTeams,
  assignmentIdsByTeam,
}: {
  memberId: string;
  allTeams: Team[];
  assignmentIdsByTeam: Map<string, string[]>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingTeamId, setPendingTeamId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function toggleTeam(teamId: string) {
    setPendingTeamId(teamId);
    setError("");
    const supabase = createClient();
    const existingIds = assignmentIdsByTeam.get(teamId) ?? [];

    const { error: opError } =
      existingIds.length > 0
        ? await supabase.from("role_assignments").delete().in("id", existingIds)
        : await supabase
            .from("role_assignments")
            .insert({ member_id: memberId, scope_type: "team", scope_id: teamId, role: "member" });

    setPendingTeamId(null);
    if (opError) {
      setError(opError.message);
      return;
    }
    router.refresh();
  }

  if (allTeams.length === 0) return null;

  return (
    <div className={styles.field}>
      <button type="button" className={styles.linkButton} onClick={() => setOpen((v) => !v)}>
        {open ? "Hide teams" : "Manage teams"}
      </button>
      {open && (
        <div className={styles.tagRow}>
          {allTeams.map((team) => {
            const isMember = (assignmentIdsByTeam.get(team.id) ?? []).length > 0;
            const busy = pendingTeamId === team.id;
            return (
              <button
                key={team.id}
                type="button"
                className={isMember ? styles.pill : styles.pillMuted}
                disabled={busy}
                aria-pressed={isMember}
                onClick={() => toggleTeam(team.id)}
              >
                {isMember ? "✓ " : "+ "}
                {team.name}
              </button>
            );
          })}
        </div>
      )}
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
