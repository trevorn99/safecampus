import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { Avatar } from "@/components/Avatar";
import { getAvatarUrlMap } from "@/lib/avatars";
import styles from "@/styles/ui.module.css";

export default async function DashboardPage() {
  const { supabase, member, organizationName, isAdmin, isPlatformAdmin } = await requireMembership();

  const { data: memberRow } = await supabase
    .from("members")
    .select("profile_picture_url")
    .eq("id", member.id)
    .single();
  const avatarUrls = await getAvatarUrlMap(supabase, [memberRow?.profile_picture_url]);
  const avatarUrl = memberRow?.profile_picture_url
    ? (avatarUrls.get(memberRow.profile_picture_url) ?? null)
    : null;

  return (
    <>
      <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
      <main className={styles.appMain}>
        <div className={styles.card}>
          <div className={styles.identityRow}>
            <Avatar name={member.name} url={avatarUrl} size="lg" />
            <div className={styles.cardHeader}>
              {isAdmin && <span className={styles.badge}>Org admin</span>}
              <h1 className={styles.cardTitle}>{organizationName}</h1>
              <p className={styles.subtitle}>Welcome, {member.name}.</p>
            </div>
          </div>
          <div className={styles.actions}>
            <a href="/team" className={`${styles.button} ${styles.buttonSecondary}`}>
              View team
            </a>
            {isAdmin && (
              <a href="/team/invite" className={`${styles.button} ${styles.buttonPrimary}`}>
                Invite a team member
              </a>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
