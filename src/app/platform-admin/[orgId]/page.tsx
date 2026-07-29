import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppHeader } from "@/components/AppHeader";
import { RegenerateReportButton } from "./RegenerateReportButton";
import styles from "@/styles/ui.module.css";

const ROLE_LABEL: Record<string, string> = {
  org_admin: "Org admin",
  location_manager: "Location manager",
  team_lead: "Team lead",
  member: "Member",
};

type RoleAssignment = { member_id: string; scope_type: string; scope_id: string; role: string };

export default async function PlatformAdminOrgPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: isPlatformAdmin } = await supabase.rpc("is_platform_admin");
  if (!isPlatformAdmin) {
    redirect("/dashboard");
  }

  // Read-only troubleshoot view — only reachable with a live, self-granted
  // support_access_grants row for this exact org (see has_active_support_grant()
  // in the support-access-grants migration). No standing elevated RLS.
  const { data: hasGrant } = await supabase.rpc("has_active_support_grant", { target_org: orgId });
  if (!hasGrant) {
    redirect("/platform-admin");
  }

  const admin = createAdminClient();
  const [{ data: organization }, { data: members }, { data: roleAssignments }, { data: locations }, { data: teams }] =
    await Promise.all([
      admin.from("organizations").select("name").eq("id", orgId).single(),
      admin
        .from("members")
        .select("id, name, email, status")
        .eq("organization_id", orgId)
        .order("name"),
      admin.from("role_assignments").select("member_id, scope_type, scope_id, role"),
      admin.from("locations").select("id, name").eq("organization_id", orgId),
      admin.from("teams").select("id, name").eq("organization_id", orgId),
    ]);

  const locationNames = new Map((locations ?? []).map((location) => [location.id, location.name]));
  const teamNames = new Map((teams ?? []).map((team) => [team.id, team.name]));
  const memberIds = new Set((members ?? []).map((member) => member.id));

  function describeScope(row: RoleAssignment) {
    if (row.scope_type === "org") return "Organization-wide";
    if (row.scope_type === "location") return locationNames.get(row.scope_id) ?? "Unknown location";
    return teamNames.get(row.scope_id) ?? "Unknown team";
  }

  const rolesByMember = new Map<string, RoleAssignment[]>();
  for (const row of (roleAssignments ?? []) as RoleAssignment[]) {
    if (!memberIds.has(row.member_id)) continue;
    const list = rolesByMember.get(row.member_id) ?? [];
    list.push(row);
    rolesByMember.set(row.member_id, list);
  }

  return (
    <>
      <AppHeader isAdmin={false} isPlatformAdmin />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>{organization?.name ?? "Organization"}</h1>
          <p className={styles.subtitle}>Support view — mostly read-only, with a few limited support actions</p>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Roster</h2>
          </div>
          {(members ?? []).length === 0 && <p className={styles.helperText}>No members yet.</p>}
          <ul className={styles.list}>
            {(members ?? []).map((member) => (
              <li key={member.id} className={styles.listRow}>
                <div>
                  <p className={styles.itemName}>{member.name}</p>
                  <p className={styles.itemMeta}>{member.email}</p>
                </div>
                <div className={styles.tagRow}>
                  {(rolesByMember.get(member.id) ?? []).map((row, index) => (
                    <span key={index} className={styles.pill}>
                      {ROLE_LABEL[row.role] ?? row.role} · {describeScope(row)}
                    </span>
                  ))}
                  {member.status === "pending" && <span className={styles.pillMuted}>Pending</span>}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Locations</h2>
          </div>
          {(locations ?? []).length === 0 && <p className={styles.helperText}>No locations yet.</p>}
          <ul className={styles.list}>
            {(locations ?? []).map((location) => (
              <li key={location.id} className={styles.listRow}>
                <p className={styles.itemName}>{location.name}</p>
                <RegenerateReportButton locationId={location.id} />
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Teams</h2>
          </div>
          {(teams ?? []).length === 0 && <p className={styles.helperText}>No teams yet.</p>}
          <ul className={styles.list}>
            {(teams ?? []).map((team) => (
              <li key={team.id} className={styles.listRow}>
                <p className={styles.itemName}>{team.name}</p>
              </li>
            ))}
          </ul>
        </div>

        <Link href="/platform-admin" className={`${styles.button} ${styles.buttonSecondary}`}>
          Back to all organizations
        </Link>
      </main>
    </>
  );
}
