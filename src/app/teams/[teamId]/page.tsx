import Link from "next/link";
import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { Avatar } from "@/components/Avatar";
import { getAvatarUrlMap } from "@/lib/avatars";
import { EditTeamForm } from "./EditTeamForm";
import { AddTeamMemberForm } from "./AddTeamMemberForm";
import { RemoveTeamMemberButton } from "./RemoveTeamMemberButton";
import { DeleteTeamButton } from "./DeleteTeamButton";
import { TeamRequirements } from "./TeamRequirements";
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

  const [{ data: team }, { data: locations }, { data: assignments }, { data: orgMembers }, { data: requirements }] =
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
        .select("id, name, profile_picture_url")
        .eq("organization_id", member.organization_id)
        .order("name"),
      supabase.from("team_requirements").select("id, kind, name").eq("team_id", teamId).order("name"),
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
  const memberById = new Map((orgMembers ?? []).map((m) => [m.id, m]));
  const assignedMemberIds = new Set((assignments ?? []).map((row) => row.member_id));
  const availableMembers = (orgMembers ?? []).filter((m) => !assignedMemberIds.has(m.id));
  const avatarUrls = await getAvatarUrlMap(
    supabase,
    (orgMembers ?? []).map((m) => m.profile_picture_url),
  );

  // Compliance pills need every member's certifications, not just the
  // viewer's own — certifications RLS only allows that for an org admin
  // (see "read own certifications"), so this stays admin-only or the query
  // would silently come back empty and every pill would misreport "missing".
  const certRequirements = (requirements ?? []).filter((r) => r.kind === "certification");
  const certTypesByMember = new Map<string, Set<string>>();
  if (isAdmin && certRequirements.length > 0 && assignedMemberIds.size > 0) {
    const { data: memberCerts } = await supabase
      .from("certifications")
      .select("member_id, type")
      .in("member_id", [...assignedMemberIds]);
    for (const cert of memberCerts ?? []) {
      const set = certTypesByMember.get(cert.member_id) ?? new Set<string>();
      set.add(cert.type.trim().toLowerCase());
      certTypesByMember.set(cert.member_id, set);
    }
  }

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

        {isAdmin && <TeamRequirements teamId={team.id} requirements={requirements ?? []} />}

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Team members</h2>
          </div>
          {(assignments ?? []).length === 0 && (
            <p className={styles.helperText}>No one is assigned to this team yet.</p>
          )}
          <ul className={styles.list}>
            {(assignments ?? []).map((row) => {
              const rowMember = memberById.get(row.member_id);
              const avatarUrl = rowMember?.profile_picture_url
                ? (avatarUrls.get(rowMember.profile_picture_url) ?? null)
                : null;
              const heldCerts = certTypesByMember.get(row.member_id) ?? new Set<string>();
              return (
                <li key={row.id} className={styles.listRow}>
                  <div className={styles.identityRow}>
                    <Avatar name={rowMember?.name ?? "?"} url={avatarUrl} size="lg" />
                    <div>
                      <p className={styles.itemName}>{rowMember?.name ?? "Unknown member"}</p>
                      <p className={styles.itemMeta}>{ROLE_LABEL[row.role] ?? row.role}</p>
                    </div>
                  </div>
                  <div className={styles.tagRow}>
                    {isAdmin &&
                      certRequirements.map((requirement) => {
                        const has = heldCerts.has(requirement.name.trim().toLowerCase());
                        return (
                          <span key={requirement.id} className={has ? styles.pill : styles.pillDanger}>
                            {has ? "✓" : "✗"} {requirement.name}
                          </span>
                        );
                      })}
                    {isAdmin && (
                      <RemoveTeamMemberButton
                        assignmentId={row.id}
                        memberName={rowMember?.name ?? "this member"}
                      />
                    )}
                  </div>
                </li>
              );
            })}
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
