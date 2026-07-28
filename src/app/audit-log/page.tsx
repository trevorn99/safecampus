import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { getAuditLogDetails } from "@/lib/auditLogDetails";
import styles from "@/styles/ui.module.css";

const TABLE_LABEL: Record<string, string> = {
  role_assignments: "Role assignment",
  certifications: "Certification",
  background_checks: "Background check",
  watchlist_entries: "Watchlist entry",
  documents: "Document",
  incident_reports: "Incident report",
};

const ACTION_LABEL: Record<string, string> = {
  INSERT: "Created",
  UPDATE: "Updated",
  DELETE: "Deleted",
};

const ACTOR_LABEL: Record<string, string> = {
  platform_admin: "SafeCampus support",
  system: "System",
};

const LOG_LIMIT = 200;

export default async function AuditLogPage() {
  const { supabase, member, organizationName, isAdmin, isPlatformAdmin } = await requireMembership();

  if (!isAdmin) {
    redirect("/dashboard");
  }

  const [{ data: logs }, { data: orgMembers }] = await Promise.all([
    supabase
      .from("audit_logs")
      .select("id, actor_id, actor_type, action, table_name, record_id, occurred_at")
      .eq("organization_id", member.organization_id)
      .order("occurred_at", { ascending: false })
      .limit(LOG_LIMIT),
    supabase.from("members").select("user_id, name").eq("organization_id", member.organization_id),
  ]);

  const details = await getAuditLogDetails(supabase, member.organization_id, logs ?? []);

  const nameByUserId = new Map(
    (orgMembers ?? []).filter((m) => m.user_id).map((m) => [m.user_id as string, m.name]),
  );

  function describeActor(log: { actor_id: string | null; actor_type: string }) {
    if (log.actor_id) {
      return nameByUserId.get(log.actor_id) ?? ACTOR_LABEL[log.actor_type] ?? "Unknown";
    }
    return ACTOR_LABEL[log.actor_type] ?? "System";
  }

  return (
    <>
      <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>Audit log</h1>
          <p className={styles.subtitle}>{organizationName} · most recent {LOG_LIMIT} changes</p>
        </div>

        <div className={styles.card}>
          {(logs ?? []).length === 0 && <p className={styles.helperText}>No changes recorded yet.</p>}
          <ul className={styles.list}>
            {(logs ?? []).map((log) => {
              const detail =
                log.action !== "DELETE" && log.record_id
                  ? details.get(`${log.table_name}:${log.record_id}`)
                  : null;
              return (
                <li key={log.id} className={styles.listRow}>
                  <div>
                    <p className={styles.itemName}>
                      {ACTION_LABEL[log.action] ?? log.action} {TABLE_LABEL[log.table_name] ?? log.table_name}
                    </p>
                    <p className={styles.itemMeta}>{detail ?? (log.action === "DELETE" ? "(record deleted)" : "Details unavailable")}</p>
                    <p className={styles.itemMeta}>
                      {describeActor(log)} · {new Date(log.occurred_at).toLocaleString()}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </>
  );
}
