import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { Avatar } from "@/components/Avatar";
import { getAvatarUrlMap } from "@/lib/avatars";
import { CancelInviteButton } from "./CancelInviteButton";
import styles from "@/styles/ui.module.css";

const ROLE_LABEL: Record<string, string> = {
  org_admin: "Org admin",
  location_manager: "Location manager",
  team_lead: "Team lead",
  member: "Member",
};

type RoleAssignment = { member_id: string; scope_type: string; scope_id: string; role: string };
type Member = {
  id: string;
  name: string;
  email: string | null;
  status: string;
  profile_picture_url: string | null;
};

export default async function TeamPage() {
  const { supabase, member, organizationName, isAdmin, isPlatformAdmin } = await requireMembership();

  const [{ data: members }, { data: roleAssignments }, { data: locations }, { data: teams }] =
    await Promise.all([
      supabase
        .from("members")
        .select("id, name, email, status, profile_picture_url")
        .eq("organization_id", member.organization_id)
        .order("name"),
      supabase.from("role_assignments").select("member_id, scope_type, scope_id, role"),
      supabase.from("locations").select("id, name").eq("organization_id", member.organization_id),
      supabase.from("teams").select("id, name").eq("organization_id", member.organization_id).order("name"),
    ]);

  const avatarUrls = await getAvatarUrlMap(
    supabase,
    (members ?? []).map((teamMember) => teamMember.profile_picture_url),
  );

  const memberById = new Map((members ?? []).map((m) => [m.id, m as Member]));
  const locationNames = new Map((locations ?? []).map((location) => [location.id, location.name]));
  const teamNames = new Map((teams ?? []).map((team) => [team.id, team.name]));

  function describeScope(row: RoleAssignment) {
    if (row.scope_type === "org") return "Organization-wide";
    if (row.scope_type === "location") return locationNames.get(row.scope_id) ?? "Unknown location";
    return teamNames.get(row.scope_id) ?? "Unknown team";
  }

  const rolesByMember = new Map<string, RoleAssignment[]>();
  for (const row of (roleAssignments ?? []) as RoleAssignment[]) {
    const list = rolesByMember.get(row.member_id) ?? [];
    list.push(row);
    rolesByMember.set(row.member_id, list);
  }

  // Group by team — a member on multiple teams shows up in each section
  // they actually belong to.
  const memberIdsByTeam = new Map<string, Set<string>>();
  const memberIdsInAnyTeam = new Set<string>();
  for (const row of (roleAssignments ?? []) as RoleAssignment[]) {
    if (row.scope_type !== "team") continue;
    const set = memberIdsByTeam.get(row.scope_id) ?? new Set<string>();
    set.add(row.member_id);
    memberIdsByTeam.set(row.scope_id, set);
    memberIdsInAnyTeam.add(row.member_id);
  }
  const unassignedMembers = (members ?? []).filter((m) => !memberIdsInAnyTeam.has(m.id));

  function renderMemberRow(teamMember: Member) {
    return (
      <li key={teamMember.id} className={styles.listRow}>
        <div className={styles.identityRow}>
          <Avatar
            name={teamMember.name}
            url={
              teamMember.profile_picture_url ? (avatarUrls.get(teamMember.profile_picture_url) ?? null) : null
            }
            size="xl"
          />
          <div>
            <p className={styles.itemName}>{teamMember.name}</p>
            <p className={styles.itemMeta}>{teamMember.email}</p>
          </div>
        </div>
        <div className={styles.tagRow}>
          {(rolesByMember.get(teamMember.id) ?? []).map((row, index) => (
            <span key={index} className={styles.pill}>
              {ROLE_LABEL[row.role] ?? row.role} · {describeScope(row)}
            </span>
          ))}
          {teamMember.status === "pending" && <span className={styles.pillMuted}>Pending</span>}
          {isAdmin && teamMember.status === "pending" && (
            <CancelInviteButton memberId={teamMember.id} name={teamMember.name} />
          )}
        </div>
      </li>
    );
  }

  return (
    <>
      <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>Team roster</h1>
          <p className={styles.subtitle}>{organizationName}</p>
        </div>

        {(members ?? []).length === 0 && (
          <div className={styles.card}>
            <p className={styles.helperText}>No members yet.</p>
          </div>
        )}

        {(teams ?? []).map((team) => {
          const teamMemberIds = memberIdsByTeam.get(team.id);
          if (!teamMemberIds || teamMemberIds.size === 0) return null;
          return (
            <div key={team.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>{team.name}</h2>
              </div>
              <ul className={styles.list}>
                {[...teamMemberIds]
                  .map((id) => memberById.get(id))
                  .filter((m): m is Member => Boolean(m))
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(renderMemberRow)}
              </ul>
            </div>
          );
        })}

        {unassignedMembers.length > 0 && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>No team assigned</h2>
            </div>
            <ul className={styles.list}>{unassignedMembers.map((m) => renderMemberRow(m as Member))}</ul>
          </div>
        )}

        {isAdmin && (
          <div className={styles.actions}>
            <a href="/team/invite" className={`${styles.button} ${styles.buttonPrimary}`}>
              Invite a team member
            </a>
          </div>
        )}
      </main>
    </>
  );
}
