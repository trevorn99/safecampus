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
  leadTeamIds,
}: {
  memberId: string;
  allTeams: Team[];
  assignmentIdsByTeam: Map<string, string[]>;
  leadTeamIds: string[];
}) {
  const router = useRouter();
  const [pendingTeamId, setPendingTeamId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function toggleTeam(teamId: string) {
    setPendingTeamId(teamId);
    setError("");
    const supabase = createClient();
    const existingIds = assignmentIdsByTeam.get(teamId) ?? [];

    // .select() on both: a change RLS refuses comes back as zero rows, not
    // an error, and would otherwise look like it worked until the refresh
    // showed nothing had changed.
    const { data: changed, error: opError } =
      existingIds.length > 0
        ? await supabase.from("role_assignments").delete().in("id", existingIds).select("id")
        : await supabase
            .from("role_assignments")
            .insert({ member_id: memberId, scope_type: "team", scope_id: teamId, role: "member" })
            .select("id");

    setPendingTeamId(null);
    if (opError) {
      setError(opError.message);
      return;
    }
    if (!changed || changed.length === 0) {
      setError("That change wasn't saved. Refresh the page and try again.");
      return;
    }
    router.refresh();
  }

  // Promote to team lead or step back to member, on a team they're already
  // on. Updates their existing assignment rather than adding a second one.
  async function setLead(teamId: string, lead: boolean) {
    setPendingTeamId(teamId);
    setError("");
    const { data: changed, error: opError } = await createClient()
      .from("role_assignments")
      .update({ role: lead ? "team_lead" : "member" })
      .in("id", assignmentIdsByTeam.get(teamId) ?? [])
      .select("id");
    setPendingTeamId(null);
    if (opError || !changed || changed.length === 0) {
      setError(opError?.message ?? "That change wasn't saved. Refresh the page and try again.");
      return;
    }
    router.refresh();
  }

  const memberOf = allTeams.filter((team) => (assignmentIdsByTeam.get(team.id) ?? []).length > 0);

  if (allTeams.length === 0) return null;

  // The row owns the Teams button; this is only the panel it opens. Every
  // team is a separate toggle — someone can belong to as many as apply.
  return (
    <div className={styles.field}>
      <p className={styles.hint}>Tap a team to add or remove them. Someone can be on any number of teams.</p>
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
      {memberOf.length > 0 && (
        <>
          <p className={styles.hint}>
            Team lead — can send announcements to that team.
          </p>
          <div className={styles.tagRow}>
            {memberOf.map((team) => {
              const isLead = leadTeamIds.includes(team.id);
              return (
                <label key={team.id} className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={isLead}
                    disabled={pendingTeamId === team.id}
                    onChange={() => void setLead(team.id, !isLead)}
                  />
                  Lead of {team.name}
                </label>
              );
            })}
          </div>
        </>
      )}
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
