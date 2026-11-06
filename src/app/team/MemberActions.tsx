"use client";

import { useState } from "react";
import { EditMemberForm } from "./EditMemberForm";
import { TeamMembershipManager } from "./TeamMembershipManager";
import { SendInviteButton } from "./SendInviteButton";
import { RemoveMemberButton } from "./RemoveMemberButton";
import styles from "@/styles/ui.module.css";

type Team = { id: string; name: string };

// Every admin action for one roster row, in one fixed cluster with one
// button style. They used to be scattered through the row's tag list as a
// mix of text links and full-size buttons, so the row reflowed differently
// for every member depending on how many role tags they had — "Manage
// teams" landed on a line of its own for some people and at the far right
// for others.
//
// Edit and Teams open a panel beneath the row rather than expanding in
// place, so opening one doesn't shove the other buttons around. Only one is
// open at a time.
export function MemberActions({
  memberId,
  name,
  email,
  status,
  linked,
  isSelf,
  allTeams,
  assignmentIdsByTeam,
  leadTeamIds,
}: {
  memberId: string;
  name: string;
  email: string | null;
  status: string;
  /** Has an account, so an invitation has gone out. */
  linked: boolean;
  isSelf: boolean;
  allTeams: Team[];
  assignmentIdsByTeam: Map<string, string[]>;
  /** Teams this member leads. */
  leadTeamIds: string[];
}) {
  const [panel, setPanel] = useState<"edit" | "teams" | null>(null);
  const toggle = (next: "edit" | "teams") => setPanel((current) => (current === next ? null : next));
  const pending = status === "pending";
  const button = `${styles.button} ${styles.buttonSecondary} ${styles.buttonCompact}`;

  return (
    <>
      <div className={styles.rosterActions}>
        <button type="button" className={button} aria-expanded={panel === "edit"} onClick={() => toggle("edit")}>
          Edit
        </button>
        {allTeams.length > 0 && (
          <button
            type="button"
            className={button}
            aria-expanded={panel === "teams"}
            onClick={() => toggle("teams")}
          >
            Teams
          </button>
        )}
        {/* Shown whether or not they've been invited: an invitation that
            went to spam left an admin watching "Invite pending" with
            nothing they could do about it. */}
        {pending && email && (
          <SendInviteButton memberId={memberId} name={name} alreadyInvited={linked} compact />
        )}
        <RemoveMemberButton
          memberId={memberId}
          name={name}
          status={status}
          invited={linked}
          isSelf={isSelf}
          compact
        />
      </div>

      {panel && (
        <div className={styles.rosterPanel}>
          {panel === "edit" ? (
            <EditMemberForm
              memberId={memberId}
              name={name}
              email={email}
              linked={linked}
              onClose={() => setPanel(null)}
            />
          ) : (
            <TeamMembershipManager
              memberId={memberId}
              allTeams={allTeams}
              assignmentIdsByTeam={assignmentIdsByTeam}
              leadTeamIds={leadTeamIds}
            />
          )}
        </div>
      )}
    </>
  );
}
