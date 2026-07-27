import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import styles from "@/styles/ui.module.css";

export default async function DashboardPage() {
  const { member, organizationName, isAdmin } = await requireMembership();

  return (
    <>
      <AppHeader isAdmin={isAdmin} />
      <main className={styles.appMain}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            {isAdmin && <span className={styles.badge}>Org admin</span>}
            <h1 className={styles.cardTitle}>{organizationName}</h1>
            <p className={styles.subtitle}>Welcome, {member.name}.</p>
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
