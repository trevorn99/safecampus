import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { SupportRequestForm } from "./SupportRequestForm";
import styles from "@/styles/ui.module.css";

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

export default async function SupportPage() {
  const { supabase, member, isAdmin, isPlatformAdmin } = await requireMembership();

  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("id, subject, status, created_at")
    .eq("organization_id", member.organization_id)
    .order("created_at", { ascending: false });

  return (
    <>
      <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>Support</h1>
          <p className={styles.subtitle}>Get help from the SafeCampus team</p>
        </div>

        <SupportRequestForm memberId={member.id} organizationId={member.organization_id} />

        {(tickets ?? []).length > 0 && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Your organization&apos;s requests</h2>
            </div>
            <ul className={styles.list}>
              {(tickets ?? []).map((ticket) => (
                <li key={ticket.id} className={styles.listRow}>
                  <div>
                    <p className={styles.itemName}>{ticket.subject}</p>
                    <p className={styles.itemMeta}>
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={styles.pill}>{STATUS_LABEL[ticket.status] ?? ticket.status}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </>
  );
}
