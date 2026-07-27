import Link from "next/link";
import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { EditTeamForm } from "./EditTeamForm";
import { AddTeamMemberForm } from "./AddTeamMemberForm";
import { RemoveTeamMemberButton } from "./RemoveTeamMemberButton";
import { DeleteTeamButton } from "./DeleteTeamButton";
import styles from "@/styles/ui.module.css";

const ROLE_LABEL: Record<string, string> = {
  team_lead: "Team lead",
  member: "Member",
};

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const { supabase, member, organizationName, isAdmin, isPlatformAdmin } = await requireMembership();

  const [{ data: team }, { data: locations }, { data: assignments }, { data: orgMembers }] =
    await Promise.all([
      supabase.from("teams").select("id, name, type, location_id").eq("id", teamId).maybeSingle(),
      supabase.from("locations").select("id, name").eq("organization_id", member.organization_id),
      supabase
        .from("role_assignments")
        .select("id, member_id, role")
        .eq("scope_type", "team")
        .eq("scope_id", teamId),
      supabase
        .from("members")
        .select("id, name")
        .eq("organization_id", member.organization_id)
        .order("name"),
    ]);

  if (!team) {
    return (
      <>
        <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
        <main className={styles.appMain}>
          <p className={styles.helperText}>Team not found.</p>
          <Link href="/teams" className={styles.link}>
            ← Back to teams
          </Link>
        </main>
      </>
    );
  }

  const locationName = locations?.find((location) => location.id === team.location_id)?.name;
  const memberNameById = new Map((orgMembers ?? []).map((m) => [m.id, m.name]));
  const assignedMemberIds = new Set((assignments ?? []).map((row) => row.member_id));
  const availableMembers = (orgMembers ?? []).filter((m) => !assignedMemberIds.has(m.id));

  return (
    <>
      <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>{team.name}</h1>
          <p className={styles.subtitle}>
            {organizationName} · {team.type} · {locationName ?? "Org-wide"}
          </p>
        </div>

        {isAdmin ? (
          <EditTeamForm team={team} locations={locations ?? []} />
        ) : (
          <p className={styles.itemMeta}>
            {team.type} · {locationName ?? "Org-wide"}
          </p>
        )}

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Team members</h2>
          </div>
          {(assignments ?? []).length === 0 && (
            <p className={styles.helperText}>No one is assigned to this team yet.</p>
          )}
          <ul className={styles.list}>
            {(assignments ?? []).map((row) => (
              <li key={row.id} className={styles.listRow}>
                <div>
                  <p className={styles.itemName}>{memberNameById.get(row.member_id) ?? "Unknown member"}</p>
                  <p className={styles.itemMeta}>{ROLE_LABEL[row.role] ?? row.role}</p>
                </div>
                {isAdmin && (
                  <RemoveTeamMemberButton
                    assignmentId={row.id}
                    memberName={memberNameById.get(row.member_id) ?? "this member"}
                  />
                )}
              </li>
            ))}
          </ul>
          {isAdmin && <AddTeamMemberForm teamId={team.id} members={availableMembers} />}
        </div>

        {isAdmin && <DeleteTeamButton teamId={team.id} name={team.name} />}

        <Link href="/teams" className={styles.link}>
          ← Back to teams
        </Link>
      </main>
    </>
  );
}
