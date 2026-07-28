import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const ROLE_LABEL: Record<string, string> = {
  org_admin: "Org admin",
  location_manager: "Location manager",
  team_lead: "Team lead",
  member: "Member",
};

type LogRow = { table_name: string; record_id: string | null; action: string };

// Audit log rows only ever store IDs (no before/after snapshot), so "detail"
// means resolving each record_id against its table's *current* state.
// DELETEd rows have nothing left to join against — those are skipped and
// just render as "(deleted)" in the page.
export async function getAuditLogDetails(
  supabase: SupabaseClient,
  organizationId: string,
  logs: LogRow[],
): Promise<Map<string, string>> {
  const idsByTable = new Map<string, Set<string>>();
  for (const log of logs) {
    if (log.action === "DELETE" || !log.record_id) continue;
    const set = idsByTable.get(log.table_name) ?? new Set<string>();
    set.add(log.record_id);
    idsByTable.set(log.table_name, set);
  }
  if (idsByTable.size === 0) return new Map();

  const [{ data: members }, { data: locations }, { data: teams }] = await Promise.all([
    supabase.from("members").select("id, name").eq("organization_id", organizationId),
    supabase.from("locations").select("id, name").eq("organization_id", organizationId),
    supabase.from("teams").select("id, name").eq("organization_id", organizationId),
  ]);
  const memberName = new Map((members ?? []).map((m) => [m.id, m.name]));
  const locationName = new Map((locations ?? []).map((l) => [l.id, l.name]));
  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]));

  function describeScope(scopeType: string, scopeId: string) {
    if (scopeType === "org") return "organization-wide";
    if (scopeType === "location") return locationName.get(scopeId) ?? "an unknown location";
    return teamName.get(scopeId) ?? "an unknown team";
  }

  const details = new Map<string, string>();

  const roleAssignmentIds = idsByTable.get("role_assignments");
  if (roleAssignmentIds) {
    const { data } = await supabase
      .from("role_assignments")
      .select("id, member_id, role, scope_type, scope_id")
      .in("id", [...roleAssignmentIds]);
    for (const row of data ?? []) {
      details.set(
        `role_assignments:${row.id}`,
        `${memberName.get(row.member_id) ?? "Unknown member"} — ${ROLE_LABEL[row.role] ?? row.role} (${describeScope(row.scope_type, row.scope_id)})`,
      );
    }
  }

  const certificationIds = idsByTable.get("certifications");
  if (certificationIds) {
    const { data } = await supabase
      .from("certifications")
      .select("id, member_id, type")
      .in("id", [...certificationIds]);
    for (const row of data ?? []) {
      details.set(`certifications:${row.id}`, `${row.type} — ${memberName.get(row.member_id) ?? "Unknown member"}`);
    }
  }

  const backgroundCheckIds = idsByTable.get("background_checks");
  if (backgroundCheckIds) {
    const { data } = await supabase
      .from("background_checks")
      .select("id, member_id, provider, status")
      .in("id", [...backgroundCheckIds]);
    for (const row of data ?? []) {
      details.set(
        `background_checks:${row.id}`,
        `${row.provider ?? "Background check"} (${row.status}) — ${memberName.get(row.member_id) ?? "Unknown member"}`,
      );
    }
  }

  const documentIds = idsByTable.get("documents");
  if (documentIds) {
    const { data } = await supabase
      .from("documents")
      .select("id, category, uploaded_by")
      .in("id", [...documentIds]);
    for (const row of data ?? []) {
      details.set(
        `documents:${row.id}`,
        `${row.category} — uploaded by ${(row.uploaded_by && memberName.get(row.uploaded_by)) ?? "Unknown member"}`,
      );
    }
  }

  const watchlistIds = idsByTable.get("watchlist_entries");
  if (watchlistIds) {
    const { data } = await supabase
      .from("watchlist_entries")
      .select("id, name, severity")
      .in("id", [...watchlistIds]);
    for (const row of data ?? []) {
      details.set(`watchlist_entries:${row.id}`, `${row.name} (${row.severity} severity)`);
    }
  }

  const incidentIds = idsByTable.get("incident_reports");
  if (incidentIds) {
    const { data } = await supabase
      .from("incident_reports")
      .select("id, type, status")
      .in("id", [...incidentIds]);
    for (const row of data ?? []) {
      details.set(`incident_reports:${row.id}`, `${row.type} — ${row.status}`);
    }
  }

  return details;
}
