import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { Avatar } from "@/components/Avatar";
import { getAvatarUrlMap } from "@/lib/avatars";
import { CancelInviteButton } from "./CancelInviteButton";
import { SendInviteButton } from "./SendInviteButton";
import { TeamMembershipManager } from "./TeamMembershipManager";
import styles from "@/styles/ui.module.css";

const ROLE_LABEL: Record<string, string> = {
  org_admin: "Org admin",
  location_manager: "Location manager",
  team_lead: "Team lead",
  member: "Member",
};

const VERIFICATION_LABEL: Record<string, string> = {
  verified: "✓ Verified",
  pending: "Verification pending",
  failed: "✗ Verification failed",
  unverified: "Not verified",
};

type RoleAssignment = { id: string; member_id: string; scope_type: string; scope_id: string; role: string };
type Certification = { id: string; member_id: string; type: string; issued_at: string | null; expires_at: string | null };

// Pulled out of the component body — react-hooks/purity flags impure calls
// (Date construction with no args) made directly during render.
function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// issued_at/expires_at are `date` columns, so they arrive as "YYYY-MM-DD"
// with no time and no zone. Feeding that to new Date() parses it as UTC
// midnight, which renders as the previous day for anyone west of Greenwich —
// so the parts are formatted directly instead.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatDateOnly(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

// Comparing "YYYY-MM-DD" strings is the same as comparing the dates, and
// avoids inventing a timezone for a value that has none.
function expiryState(expiresAt: string | null, today: string, soon: string): "none" | "expired" | "soon" | "valid" {
  if (!expiresAt) return "none";
  if (expiresAt < today) return "expired";
  return expiresAt <= soon ? "soon" : "valid";
}
type Member = {
  id: string;
  name: string;
  email: string | null;
  // Null until an invite goes out — see the tri-state in the roster-only
  // members migration. A member can be scheduled long before this is set.
  user_id: string | null;
  status: string;
  profile_picture_url: string | null;
  identity_verification_status: string;
};

export default async function TeamPage() {
  const { supabase, member, organizationName, isAdmin, isPlatformAdmin } = await requireMembership();

  const today = todayIsoDate();
  // 60 days is the window the roster calls "expiring soon" — long enough that
  // a background check or a renewal course can still be booked.
  const soonCutoff = new Date(new Date(`${today}T00:00:00Z`).getTime() + 60 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const [
    { data: members },
    { data: roleAssignments },
    { data: locations },
    { data: teams },
    { data: org },
    { data: certifications },
  ] = await Promise.all([
      supabase
        .from("members")
        .select("id, name, email, user_id, status, profile_picture_url, identity_verification_status")
        .eq("organization_id", member.organization_id)
        .order("name"),
      supabase.from("role_assignments").select("id, member_id, scope_type, scope_id, role"),
      supabase.from("locations").select("id, name").eq("organization_id", member.organization_id),
      supabase.from("teams").select("id, name").eq("organization_id", member.organization_id).order("name"),
      supabase.from("organizations").select("identity_verification_enabled").eq("id", member.organization_id).single(),
      // RLS returns everyone's to an org admin and only your own otherwise,
      // so this needs no isAdmin branch — the roster shows what the viewer is
      // allowed to see. Soonest expiry first, undated last (nulls sort last
      // on an ascending order in Postgres).
      supabase
        .from("certifications")
        .select("id, member_id, type, issued_at, expires_at")
        .order("expires_at", { ascending: true })
        .returns<Certification[]>(),
    ]);

  const certsByMember = new Map<string, Certification[]>();
  for (const certification of certifications ?? []) {
    const list = certsByMember.get(certification.member_id) ?? [];
    list.push(certification);
    certsByMember.set(certification.member_id, list);
  }

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

  // memberId -> teamId -> that member's role_assignments row id(s) for that
  // team, so TeamMembershipManager can toggle membership without a lookup.
  const teamAssignmentsByMember = new Map<string, Map<string, string[]>>();
  for (const row of (roleAssignments ?? []) as RoleAssignment[]) {
    if (row.scope_type !== "team") continue;
    const byTeam = teamAssignmentsByMember.get(row.member_id) ?? new Map<string, string[]>();
    const ids = byTeam.get(row.scope_id) ?? [];
    ids.push(row.id);
    byTeam.set(row.scope_id, ids);
    teamAssignmentsByMember.set(row.member_id, byTeam);
  }

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
            <p className={styles.itemMeta}>{teamMember.email ?? "No email on file"}</p>
          </div>
        </div>
        <div className={styles.tagRow}>
          {(rolesByMember.get(teamMember.id) ?? []).map((row, index) => (
            <span key={index} className={styles.pill}>
              {ROLE_LABEL[row.role] ?? row.role} · {describeScope(row)}
            </span>
          ))}
          {teamMember.status === "pending" && (
            <span className={styles.pillMuted}>{teamMember.user_id ? "Invite pending" : "Not invited"}</span>
          )}
          {isAdmin && org?.identity_verification_enabled && (
            <span
              className={
                teamMember.identity_verification_status === "verified"
                  ? styles.pill
                  : teamMember.identity_verification_status === "failed"
                    ? styles.pillDanger
                    : styles.pillMuted
              }
            >
              {VERIFICATION_LABEL[teamMember.identity_verification_status] ?? teamMember.identity_verification_status}
            </span>
          )}
          {isAdmin && teamMember.status === "pending" && (
            <>
              {!teamMember.user_id && teamMember.email && (
                <SendInviteButton memberId={teamMember.id} name={teamMember.name} />
              )}
              <CancelInviteButton
                memberId={teamMember.id}
                name={teamMember.name}
                invited={Boolean(teamMember.user_id)}
              />
            </>
          )}
        </div>
        {(() => {
          const memberCerts = certsByMember.get(teamMember.id) ?? [];
          if (memberCerts.length === 0) return null;
          return (
            <ul className={styles.docList}>
              {memberCerts.map((certification) => {
                const state = expiryState(certification.expires_at, today, soonCutoff);
                return (
                  <li key={certification.id} className={styles.itemMeta}>
                    <strong>{certification.type}</strong>
                    {certification.issued_at ? ` · issued ${formatDateOnly(certification.issued_at)}` : ""}
                    {certification.expires_at ? ` · expires ${formatDateOnly(certification.expires_at)}` : " · no expiry"}
                    {state === "expired" && <span className={styles.pillDanger}> Expired</span>}
                    {state === "soon" && <span className={styles.pillMuted}> Expiring soon</span>}
                  </li>
                );
              })}
            </ul>
          );
        })()}

        {isAdmin && (
          <TeamMembershipManager
            memberId={teamMember.id}
            allTeams={teams ?? []}
            assignmentIdsByTeam={teamAssignmentsByMember.get(teamMember.id) ?? new Map()}
          />
        )}
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
              Add a team member
            </a>
          </div>
        )}
      </main>
    </>
  );
}
