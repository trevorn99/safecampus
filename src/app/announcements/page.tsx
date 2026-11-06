import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { senderScope } from "@/lib/announcements";
import { AnnouncementComposer } from "./AnnouncementComposer";
import styles from "@/styles/ui.module.css";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AnnouncementsPage() {
  const { supabase, member, organizationName, isAdmin, isPlatformAdmin } = await requireMembership();

  const [scope, { data: announcements }] = await Promise.all([
    senderScope(supabase, member.id, member.organization_id),
    // RLS decides what's listed: org admins see every announcement in the
    // organization; everyone else sees the ones sent to them or by them.
    supabase
      .from("announcements")
      .select("id, subject, body, sender_name, sender_member_id, audience_label, created_at, recipient_count, email_count, sms_count, sent_sms")
      .eq("organization_id", member.organization_id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const canSend = scope.isOrgAdmin || scope.allowedTeams.length > 0;

  return (
    <>
      <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>Announcements</h1>
          <p className={styles.subtitle}>{organizationName}</p>
        </div>

        {canSend && <AnnouncementComposer isOrgAdmin={scope.isOrgAdmin} teams={scope.allowedTeams} />}

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>{isAdmin ? "All announcements" : "Your announcements"}</h2>
          </div>
          {(announcements ?? []).length === 0 && <p className={styles.helperText}>No announcements yet.</p>}
          <ul className={styles.list}>
            {(announcements ?? []).map((a) => {
              const showDelivery = isAdmin || a.sender_member_id === member.id;
              return (
                <li key={a.id} className={styles.announcementItem}>
                  <p className={styles.itemName}>{a.subject}</p>
                  <p className={styles.itemMeta}>
                    From {a.sender_name} to {a.audience_label} · {formatDate(a.created_at)}
                    {showDelivery &&
                      ` · ${a.recipient_count} ${a.recipient_count === 1 ? "person" : "people"}, ${a.email_count} emailed${
                        a.sent_sms ? `, ${a.sms_count} texted` : ""
                      }`}
                  </p>
                  <p className={styles.announcementBody}>{a.body}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </>
  );
}
